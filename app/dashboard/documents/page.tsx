"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { mergeCategories, type CustomCategoryRow } from "@/lib/categories";
import { docHealth, LOW_CONFIDENCE_THRESHOLD, type HealthKey } from "@/lib/doc-status";
import { daysLeft } from "@/lib/dates";
import { deleteDocumentCascade } from "@/lib/delete-document";
import { uploadWithProgress, processDocument, type ProcessingStage } from "@/lib/upload";
import { DocIcon } from "@/components/doc-icon";
import { CategoryIcon } from "@/components/category-icon";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";

type Doc = {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  doc_type: string | null;
  doc_category: string | null;
  status: string;
  uploaded_at: string;
};

type DocMeta = {
  lowConfidenceCount: number;
  expiryDates: string[];
  searchText: string;
};

type CategoryPrompt = {
  documentId: string;
  fileName: string;
  suggested: string;
  fromUpload: boolean;
};

type DuplicatePrompt = {
  newDocumentId: string;
  newFileName: string;
  docType: string;
  existingId: string;
  existingFileName: string;
};

type JobStage = "uploading" | "uploaded" | ProcessingStage;

type UploadJob = {
  id: string;
  fileName: string;
  stage: JobStage;
  progress: number;
  error?: string;
  documentId?: string;
  summary?: string;
};

// The order a document moves through, in the words the user sees. "uploaded"
// is a real stop so a slow network and a slow model never look the same.
const JOB_STEPS: { key: JobStage; label: string; doing: string }[] = [
  { key: "uploading", label: "Upload", doing: "Uploading" },
  { key: "scanning", label: "Scan", doing: "Scanning the document" },
  { key: "extracting", label: "Extract", doing: "Extracting names, numbers and dates" },
  { key: "analysing", label: "Analyse", doing: "Identifying expiry dates, people and categories" },
  { key: "indexing", label: "Index", doing: "Making it searchable for Ask NEXUS" },
  { key: "ready", label: "Ready", doing: "Ready" },
];

function stepIndex(stage: JobStage): number {
  if (stage === "uploaded") return 1;
  if (stage === "failed") return -1;
  return JOB_STEPS.findIndex((s) => s.key === stage);
}

type SmartFilter = "all" | "expiring" | "expired" | "needs_review" | "recent";

const SMART_FILTERS: { key: SmartFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expiring", label: "Expiring" },
  { key: "expired", label: "Expired" },
  { key: "needs_review", label: "Needs review" },
  { key: "recent", label: "Recently added" },
];

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsPageInner />
    </Suspense>
  );
}

function DocumentsPageInner() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [docMeta, setDocMeta] = useState<Map<string, DocMeta>>(new Map());
  const [customCategories, setCustomCategories] = useState<CustomCategoryRow[]>([]);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // /dashboard/documents?upload=1 (the Scan tile) opens straight onto the dropzone.
  const [showUpload, setShowUpload] = useState(searchParams.get("upload") === "1");
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryPrompt, setCategoryPrompt] = useState<CategoryPrompt | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const [resolvingDuplicate, setResolvingDuplicate] = useState(false);
  const [promptSelected, setPromptSelected] = useState("");
  const [promptAdding, setPromptAdding] = useState(false);
  const [promptNewName, setPromptNewName] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  const categories = mergeCategories(customCategories);
  const uploading = jobs.some((j) => j.stage === "uploading");

  function setCategory(cat: string | null) {
    const url = cat ? `/dashboard/documents?category=${encodeURIComponent(cat)}` : "/dashboard/documents";
    router.push(url);
  }

  function healthFor(doc: Doc) {
    const meta = docMeta.get(doc.id);
    return docHealth({
      status: doc.status,
      lowConfidenceCount: meta?.lowConfidenceCount || 0,
      expiryDates: meta?.expiryDates || [],
    });
  }

  function matchesSmartFilter(doc: Doc, key: HealthKey): boolean {
    if (smartFilter === "all") return true;
    if (smartFilter === "recent") return daysLeft(doc.uploaded_at) >= -7;
    return key === smartFilter;
  }

  function matchesSearch(doc: Doc): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      doc.file_name,
      doc.doc_type || "",
      doc.doc_category || "",
      docMeta.get(doc.id)?.searchText || "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  }

  const visibleDocs = docs.filter(
    (d) =>
      (!activeCategory || d.doc_category === activeCategory) &&
      matchesSmartFilter(d, healthFor(d).key) &&
      matchesSearch(d)
  );

  function styleFor(name: string): string {
    return categories.find((c) => c.name === name)?.color || "bg-slate-100 text-slate-600";
  }

  const loadDocs = useCallback(async () => {
    const [{ data: docRows }, { data: fieldRows }, { data: deadlineRows }] = await Promise.all([
      supabase.from("documents").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("document_fields").select("document_id, field_name, field_value, confidence"),
      supabase.from("deadlines").select("document_id, expiry_date").eq("status", "active"),
    ]);

    if (docRows) setDocs(docRows);

    const meta = new Map<string, DocMeta>();
    function entryFor(id: string): DocMeta {
      if (!meta.has(id)) meta.set(id, { lowConfidenceCount: 0, expiryDates: [], searchText: "" });
      return meta.get(id)!;
    }

    for (const f of fieldRows || []) {
      const entry = entryFor(f.document_id);
      if ((f.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD) entry.lowConfidenceCount += 1;
      entry.searchText += ` ${f.field_name} ${f.field_value}`;
    }
    for (const d of deadlineRows || []) {
      entryFor(d.document_id).expiryDates.push(d.expiry_date);
    }

    setDocMeta(meta);
    setLoadingList(false);
  }, [supabase]);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from("custom_categories")
      .select("name, icon")
      .order("created_at", { ascending: true });
    if (data) setCustomCategories(data);
  }, [supabase]);

  useEffect(() => {
    loadDocs();
    loadCategories();
  }, [supabase, loadDocs, loadCategories]);

  async function logActivity(action: string, message: string, documentId?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action,
      details: { message, document_id: documentId || null },
    });
  }

  async function addCustomCategory(rawName: string): Promise<string | null> {
    const name = rawName.trim();
    if (!name) return null;

    const alreadyExists = categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (alreadyExists) return name;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { error: insertError } = await supabase
      .from("custom_categories")
      .insert({ user_id: user.id, name });

    if (insertError) {
      setError(insertError.message);
      return null;
    }

    await loadCategories();
    return name;
  }

  function updateJob(id: string, patch: Partial<UploadJob>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function dismissJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  // Runs the processing pipeline for a document row that already exists,
  // rendering each stage into the job as the server reports it.
  async function runProcessing(jobId: string, documentId: string, fileName: string, fromUpload: boolean) {
    updateJob(jobId, { stage: "scanning", documentId });

    const result = await processDocument(documentId, (event) => {
      if (event.stage === "failed") {
        updateJob(jobId, { stage: "failed", error: event.error });
      } else if (event.stage === "ready") {
        const parts = [
          `${event.fields_count || 0} detail${event.fields_count === 1 ? "" : "s"}`,
          event.deadlines_count ? `${event.deadlines_count} expiry date${event.deadlines_count === 1 ? "" : "s"}` : null,
        ].filter(Boolean);
        updateJob(jobId, { stage: "ready", summary: `Found ${parts.join(" and ")}.` });
      } else {
        updateJob(jobId, { stage: event.stage });
      }
    });

    await loadDocs();

    if (result.stage !== "ready") return;

    if (result.duplicate_of) {
      setDuplicatePrompt({
        newDocumentId: documentId,
        newFileName: fileName,
        docType: (result.doc_type || "document").replace(/_/g, " "),
        existingId: result.duplicate_of.id,
        existingFileName: result.duplicate_of.file_name,
      });
    }

    if (result.doc_category) {
      setPromptSelected(result.doc_category);
      setCategoryPrompt({
        documentId,
        fileName,
        suggested: result.doc_category,
        fromUpload,
      });
    }

    // Let the "Ready" state be seen, then clear it from the tray.
    setTimeout(() => dismissJob(jobId), 6000);
  }

  async function uploadFile(file: File) {
    setError("");

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only PDF, JPG, PNG files allowed.");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size must be under 10MB.");
      return;
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setJobs((prev) => [...prev, { id: jobId, fileName: file.name, stage: "uploading", progress: 0 }]);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      updateJob(jobId, { stage: "failed", error: "You're signed out. Sign in and try again." });
      return;
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${user.id}/${timestamp}_${safeName}`;

    try {
      await uploadWithProgress(supabase, "Documents", filePath, file, (fraction) =>
        updateJob(jobId, { progress: fraction })
      );
    } catch (err) {
      updateJob(jobId, { stage: "failed", error: err instanceof Error ? err.message : "Upload failed" });
      return;
    }

    updateJob(jobId, { stage: "uploaded", progress: 1 });

    const { data: dbData, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_path: filePath,
        doc_type: null,
        status: "processing",
      })
      .select()
      .single();

    if (dbError || !dbData) {
      updateJob(jobId, { stage: "failed", error: dbError?.message || "Failed to save document" });
      return;
    }

    await loadDocs();
    logActivity("upload", `Uploaded ${file.name}`, dbData.id);

    await runProcessing(jobId, dbData.id, file.name, true);
  }

  function retryProcessing(doc: Doc) {
    const jobId = `retry-${doc.id}-${crypto.randomUUID()}`;
    setJobs((prev) => [...prev, { id: jobId, fileName: doc.file_name, stage: "scanning", progress: 1, documentId: doc.id }]);
    runProcessing(jobId, doc.id, doc.file_name, false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => uploadFile(file));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => uploadFile(file));
    e.target.value = "";
  }

  async function deleteDocument(doc: Doc) {
    await deleteDocumentCascade(supabase, doc);
    logActivity("delete", `Deleted ${doc.file_name}`);
    await loadDocs();
  }

  async function replaceDuplicate() {
    if (!duplicatePrompt) return;
    setResolvingDuplicate(true);

    const { data: old } = await supabase
      .from("documents")
      .select("id, file_name, file_path")
      .eq("id", duplicatePrompt.existingId)
      .single();

    if (old) {
      await deleteDocumentCascade(supabase, old);
      logActivity(
        "delete",
        `Replaced ${old.file_name} with ${duplicatePrompt.newFileName}`,
        duplicatePrompt.newDocumentId
      );
    }

    await loadDocs();
    setResolvingDuplicate(false);
    setDuplicatePrompt(null);
  }

  async function confirmCategory() {
    if (!categoryPrompt) return;
    setSavingPrompt(true);

    await supabase
      .from("documents")
      .update({ doc_category: promptSelected })
      .eq("id", categoryPrompt.documentId);

    logActivity(
      "category",
      `Saved ${categoryPrompt.fileName} to ${promptSelected}`,
      categoryPrompt.documentId
    );

    await loadDocs();
    setSavingPrompt(false);
    setCategoryPrompt(null);
    setPromptAdding(false);
    setPromptNewName("");
  }

  const needsAttention = docs.filter((d) => {
    const key = healthFor(d).key;
    return key === "expired" || key === "expiring" || key === "needs_review" || key === "failed";
  }).length;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold text-[#0F172A]">Vault</h1>
          <p className="text-sm text-[#64748B] mt-2">
            {docs.length === 0
              ? "Nothing here yet"
              : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
            {needsAttention > 0 && ` · ${needsAttention} need${needsAttention === 1 ? "s" : ""} attention`}
            {docs.length > 0 && needsAttention === 0 && " · All in order"}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full sm:w-48 sm:focus:w-72 transition-all pl-8 pr-3 py-2.5 bg-white border border-[#E6E8EE] rounded-full text-sm
                focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#1E293B] placeholder-[#94A3B8]"
            />
          </div>
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="px-4 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white rounded-full text-sm font-semibold shadow-md shadow-[#2563EB]/30 hover:shadow-lg transition-shadow"
          >
            + Add document
          </button>
        </div>
      </div>

      {(showUpload || (!loadingList && docs.length === 0) || dragOver) && (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-6 border-2 border-dashed rounded-2xl p-8 text-center
          transition-colors ${
            dragOver
              ? "border-[#2563EB] bg-[#EAF2FF]"
              : "border-[#E6E8EE] bg-white hover:border-[#2563EB]/50 hover:bg-[#F8FAFC]"
          }`}
      >
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm font-semibold text-[#1E293B]">
          {uploading ? "Uploading…" : "Drop a document here"}
        </p>
        <p className="text-xs text-[#64748B] mt-1">PDF, JPG or PNG, up to 10MB each</p>
        <label className="inline-block mt-4 px-4 py-2 bg-[#2563EB] text-white
          rounded-full text-sm font-medium cursor-pointer hover:bg-[#1D4ED8]
          transition-colors">
          Browse files
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>
      )}


      <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 stagger">
        {categories.map((cat) => {
          const count = docs.filter((d) => d.doc_category === cat.name).length;
          const active = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => setCategory(active ? null : cat.name)}
              className={`card card-hover py-4 flex flex-col items-center gap-2 ${active ? "!border-[#2563EB] ring-2 ring-[#2563EB]/15" : ""}`}
            >
              <CategoryIcon name={cat.name} emoji={cat.icon} />
              <span className="text-xs font-medium text-[#0F172A] px-2 truncate max-w-full">{cat.name}</span>
              <span className="text-[11px] text-[#64748B]">{count}</span>
            </button>
          );
        })}
        {addingCategory ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const added = await addCustomCategory(newCategoryName);
              setNewCategoryName("");
              setAddingCategory(false);
              if (added) setCategory(added);
            }}
            className="bg-white rounded-2xl border border-[#E6E8EE] p-3 flex flex-col gap-2"
          >
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onBlur={() => { if (!newCategoryName.trim()) setAddingCategory(false); }}
              placeholder="Name"
              className="text-xs px-2.5 py-1.5 border border-[#E6E8EE] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
            <button type="submit" className="text-xs py-1.5 bg-[#2563EB] text-white rounded-lg font-medium">Add</button>
          </form>
        ) : (
          <button
            onClick={() => setAddingCategory(true)}
            className="rounded-2xl border border-dashed border-[#E6E8EE] py-4 flex flex-col items-center gap-2 text-[#64748B]
              hover:border-[#2563EB]/60 hover:text-[#2563EB] transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-[#F8FAFC] flex items-center justify-center text-lg">+</span>
            <span className="text-xs font-medium">New</span>
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {SMART_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setSmartFilter(f.key)}
            className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors ${
              smartFilter === f.key
                ? "bg-[#0F172A] text-white"
                : "bg-white text-[#64748B] border border-[#E6E8EE] hover:text-[#0F172A]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {smartFilter === "needs_review" && (
        <div className="mt-3 rounded-2xl border border-[#FBCFE8] bg-[#FDF2F8]/60 px-4 py-3">
          <p className="text-sm font-semibold text-[#DB2777]">About &ldquo;Needs review&rdquo;</p>
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            NEXUS scores how sure it is about each value it reads. A blurry scan or handwriting can
            leave it unsure. Those values feed your answers and form-filling, so open the document
            and confirm or correct them.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {jobs.length > 0 && (
        <div className="mt-4 space-y-3">
          {jobs.map((job) => (
            <UploadJobCard
              key={job.id}
              job={job}
              onDismiss={() => dismissJob(job.id)}
              onRetry={job.documentId ? () => { dismissJob(job.id); retryProcessing({ id: job.documentId!, file_name: job.fileName } as Doc); } : undefined}
            />
          ))}
        </div>
      )}

      <div className="mt-5 card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_32px] md:grid-cols-[1fr_140px_110px_130px_40px] gap-3 px-4 md:px-5 py-3 border-b border-[#E6E8EE]
          text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
          <span>Document</span>
          <span className="hidden md:block">Category</span>
          <span className="hidden md:block">Added</span>
          <span>Status</span>
          <span />
        </div>
        {loadingList ? (
          <div className="divide-y divide-[#E6E8EE]/70" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <span className="skeleton w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2"><span className="skeleton block h-3 w-1/3" /><span className="skeleton block h-2.5 w-1/5" /></div>
                <span className="skeleton h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-[#64748B]">
              {search.trim()
                ? `Nothing matches "${search.trim()}".`
                : smartFilter !== "all"
                ? "Nothing in this state."
                : activeCategory
                ? `No documents in ${activeCategory} yet.`
                : "No documents yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E8EE]/70">
            {visibleDocs.map((doc) => {
              const health = healthFor(doc);
              const inFlight = jobs.some((j) => j.documentId === doc.id && j.stage !== "ready" && j.stage !== "failed");
              return (
                <div key={doc.id} className="grid grid-cols-[1fr_auto_32px] md:grid-cols-[1fr_140px_110px_130px_40px] gap-3 items-center px-4 md:px-5 py-3.5
                  hover:bg-[#F8FAFC] transition-colors">
                  <Link href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 min-w-0">
                    <DocIcon docType={doc.doc_type} fileName={doc.file_name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{doc.file_name}</p>
                      <p className="text-xs text-[#64748B] truncate capitalize">
                        {(doc.doc_type || "Document").replace(/_/g, " ")}
                        {health.key === "needs_review" && (
                          <span className="text-[#DB2777]"> · {docMeta.get(doc.id)?.lowConfidenceCount} to confirm</span>
                        )}
                      </p>
                    </div>
                  </Link>
                  <div className="hidden md:block min-w-0">
                    {doc.doc_category ? (
                      <button
                        onClick={() => {
                          setPromptSelected(doc.doc_category!);
                          setCategoryPrompt({
                            documentId: doc.id,
                            fileName: doc.file_name,
                            suggested: doc.doc_category!,
                            fromUpload: false,
                          });
                        }}
                        title="Change category"
                        className={`text-[11px] px-2 py-1 rounded-full font-medium hover:opacity-75 transition-opacity truncate max-w-full ${styleFor(doc.doc_category)}`}
                      >
                        {doc.doc_category}
                      </button>
                    ) : (
                      <span className="text-xs text-[#94A3B8]">None</span>
                    )}
                  </div>
                  <span className="hidden md:block text-xs text-[#64748B]">
                    {new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <div>
                    {health.key === "failed" && !inFlight ? (
                      <button
                        onClick={() => retryProcessing(doc)}
                        className="text-[11px] px-2 py-1 rounded-full font-semibold bg-[#EAF2FF] text-[#2563EB] hover:bg-[#CFE0FF] transition-colors"
                      >
                        Retry
                      </button>
                    ) : (
                      <span className={`text-[11px] px-2 py-1 rounded-full font-medium inline-flex items-center gap-1.5 ${health.badge}`}>
                        {(health.key === "processing" || inFlight) && <Spinner />}
                        {health.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteDocument(doc)}
                    className="text-[#94A3B8] hover:text-[#DB2777] transition-colors text-sm justify-self-end"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {duplicatePrompt && (
        <div className="fixed inset-0 bg-[#0F172A]/30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8EE]">
            <h3 className="text-lg font-semibold text-[#0F172A]">
              You already have a {duplicatePrompt.docType}
            </h3>
            <p className="text-sm text-[#64748B] mt-1.5">
              <span className="font-semibold text-[#1E293B]">{duplicatePrompt.existingFileName}</span> is already in your vault.
              Replace it with the new one, or keep both?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={replaceDuplicate}
                disabled={resolvingDuplicate}
                className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold
                  hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors shadow-sm"
              >
                {resolvingDuplicate ? "Replacing…" : "Replace"}
              </button>
              <button
                onClick={() => setDuplicatePrompt(null)}
                className="px-4 py-2.5 border border-[#E6E8EE] rounded-xl text-sm font-semibold
                  text-[#1E293B] hover:bg-[#F6F7F9] transition-colors"
              >
                Keep both
              </button>
            </div>
          </div>
        </div>
      )}

      {!duplicatePrompt && categoryPrompt && (
        <div className="fixed inset-0 bg-[#0F172A]/30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8EE]">
            {categoryPrompt.fromUpload && (
              <div className="flex items-center gap-2 text-[11px] font-semibold mb-3">
                <span className="px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">✓ Uploaded</span>
                <span className="w-3 h-px bg-[#E6E8EE]" />
                <span className="px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">✓ Read</span>
                <span className="w-3 h-px bg-[#E6E8EE]" />
                <span className="px-2 py-0.5 rounded-full bg-[#2563EB] text-white">3 Choose category</span>
              </div>
            )}
            <h3 className="text-lg font-semibold text-[#0F172A]">
              {categoryPrompt.fromUpload ? "Choose a category" : "Change category"}
            </h3>
            <p className="text-sm text-[#64748B] mt-1.5">
              Suggested: <span className="font-semibold text-[#2563EB]">{categoryPrompt.suggested}</span>. Keep it or pick another.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setPromptSelected(cat.name)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
                    promptSelected === cat.name
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                      : "bg-white text-[#64748B] border-[#E6E8EE] hover:border-[#2563EB]"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon name={cat.name} emoji={cat.icon} size="sm" />{cat.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-3">
              {promptAdding ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const added = await addCustomCategory(promptNewName);
                    if (added) setPromptSelected(added);
                    setPromptNewName("");
                    setPromptAdding(false);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    autoFocus
                    value={promptNewName}
                    onChange={(e) => setPromptNewName(e.target.value)}
                    onBlur={() => { if (!promptNewName.trim()) setPromptAdding(false); }}
                    placeholder="New category name"
                    className="flex-1 text-xs px-3 py-1.5 border border-[#E6E8EE] bg-[#F6F7F9] rounded-full
                      focus:outline-none focus:ring-1 focus:ring-[#2563EB] text-[#1E293B]"
                  />
                  <button
                    type="submit"
                    className="text-xs px-3 py-1.5 bg-[#2563EB] text-white rounded-full font-medium hover:bg-[#1D4ED8]"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setPromptAdding(true)}
                  className="text-xs text-[#2563EB] hover:underline font-semibold"
                >
                  + Create a new category
                </button>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={confirmCategory}
                disabled={savingPrompt}
                className="flex-1 py-2 bg-[#2563EB] text-white rounded-xl text-sm
                  font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors shadow-sm"
              >
                {savingPrompt ? "Saving…" : `Save to ${promptSelected}`}
              </button>
              <button
                onClick={() => { setCategoryPrompt(null); setPromptAdding(false); }}
                className="px-4 py-2 text-[#64748B] text-sm hover:text-[#1E293B] transition-colors"
              >
                {categoryPrompt.fromUpload ? "Keep suggestion" : "Skip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin"
    />
  );
}

function UploadJobCard({ job, onDismiss, onRetry }: { job: UploadJob; onDismiss: () => void; onRetry?: () => void }) {
  const current = stepIndex(job.stage);
  const failed = job.stage === "failed";
  const done = job.stage === "ready";
  const percent = Math.round(job.progress * 100);

  const headline = failed
    ? "Something went wrong"
    : done
    ? "Ready"
    : job.stage === "uploading"
    ? `Uploading · ${percent}%`
    : job.stage === "uploaded"
    ? "Upload complete · handing over to NEXUS"
    : JOB_STEPS[current]?.doing || "Working";

  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 bg-white ${
        failed ? "border-[#CFE0FF]" : done ? "border-[#BBF7D0]" : "border-[#E6E8EE]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1E293B] truncate">{job.fileName}</p>
          <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${failed ? "text-[#2563EB]" : done ? "text-[#15803D]" : "text-[#64748B]"}`}>
            {!failed && !done && <Spinner />}
            {done && <span>✓</span>}
            {headline}
          </p>
          {failed && job.error && <p className="text-xs text-[#64748B] mt-1">{job.error}</p>}
          {failed && onRetry && (
            <button onClick={onRetry} className="mt-2 text-xs px-3 py-1.5 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B]">
              Try again
            </button>
          )}
          {done && job.summary && <p className="text-xs text-[#64748B] mt-1">{job.summary}</p>}
        </div>
        {(failed || done) && (
          <button onClick={onDismiss} className="text-[#64748B]/50 hover:text-[#1E293B] text-sm" title="Dismiss">
            ✕
          </button>
        )}
      </div>

      {job.stage === "uploading" && (
        <div className="mt-2.5 h-1.5 rounded-full bg-[#FFFFFF] overflow-hidden">
          <div
            className="h-full bg-[#2563EB] rounded-full transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {!failed && (
        <ol className="mt-3 flex items-center gap-1.5 flex-wrap">
          {JOB_STEPS.map((step, i) => {
            const state = i < current || done ? "done" : i === current ? "active" : "todo";
            return (
              <li key={step.key} className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    state === "done"
                      ? "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]"
                      : state === "active"
                      ? "bg-[#2563EB] text-white border-[#2563EB]"
                      : "bg-white text-[#64748B]/50 border-[#E6E8EE]"
                  }`}
                >
                  {state === "done" ? "✓ " : ""}
                  {step.label}
                </span>
                {i < JOB_STEPS.length - 1 && <span className="w-3 h-px bg-[#E6E8EE]" />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
