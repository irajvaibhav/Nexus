"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { mergeCategories, type CustomCategoryRow } from "@/lib/categories";
import { docHealth, LOW_CONFIDENCE_THRESHOLD, type HealthKey } from "@/lib/doc-status";
import { daysLeft } from "@/lib/dates";
import { deleteDocumentCascade } from "@/lib/delete-document";
import { uploadWithProgress, processDocument, type ProcessingStage } from "@/lib/upload";
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
  { key: "analysing", label: "Analyse", doing: "Identifying what matters — expiry dates, people, categories" },
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
    return key === "expired" || key === "expiring" || key === "needs_review";
  }).length;

  return (
    <div className="max-w-4xl animate-fade-in-up">
      <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Documents</h1>
      <p className="text-sm text-[#7C6E67] mt-1">
        {docs.length === 0
          ? "Upload your first document and NEXUS will read it for you."
          : needsAttention === 0
          ? `${docs.length} document${docs.length === 1 ? "" : "s"}, all in order.`
          : `${needsAttention} of ${docs.length} document${docs.length === 1 ? "" : "s"} need${needsAttention === 1 ? "s" : ""} your attention.`}
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search documents, numbers, expiry dates…"
        className="mt-5 w-full px-4 py-2.5 bg-white border border-[#E5DFD7] rounded-xl text-sm
          focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent
          text-[#2E2724] placeholder-[#7C6E67]/50"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {SMART_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setSmartFilter(f.key)}
            className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
              smartFilter === f.key
                ? "bg-[#2E2724] text-white border-[#2E2724] shadow-sm"
                : "bg-white text-[#7C6E67] border-[#E5DFD7] hover:border-[#2E2724] hover:text-[#2E2724]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {smartFilter === "needs_review" && (
        <div className="mt-3 rounded-2xl border border-[#F9DFE6] bg-[#FDF1F5]/60 px-4 py-3">
          <p className="text-sm font-semibold text-[#C05C7B]">What &ldquo;Needs review&rdquo; means</p>
          <p className="text-xs text-[#7C6E67] mt-1 leading-relaxed">
            When NEXUS reads a document, it scores how sure it is about each value it pulls out. A
            blurry photo, a smudged stamp or a handwritten date can leave it unsure. Those values are
            what NEXUS uses to answer your questions and fill forms, so until you confirm or correct
            them the document is flagged here. Open it, check the marked values, and NEXUS will treat
            your version as certain from then on.
          </p>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-5 border-2 border-dashed rounded-2xl p-8 text-center
          transition-colors ${
            dragOver
              ? "border-[#D95D39] bg-[#FDF2EE]"
              : "border-[#E5DFD7] bg-white hover:border-[#D95D39]/50 hover:bg-[#FAF8F5]"
          }`}
      >
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm font-semibold text-[#2E2724]">
          {uploading ? "Uploading…" : "Drag & drop your document here"}
        </p>
        <p className="text-xs text-[#7C6E67] mt-1">PDF, JPG, PNG — Max 10MB each</p>
        <label className="inline-block mt-4 px-4 py-2 bg-[#D95D39] text-white
          rounded-xl text-sm font-medium cursor-pointer hover:bg-[#C24E2B]
          transition-colors shadow-sm">
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

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {jobs.length > 0 && (
        <div className="mt-4 space-y-3">
          {jobs.map((job) => (
            <UploadJobCard key={job.id} job={job} onDismiss={() => dismissJob(job.id)} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-serif font-semibold text-[#1A1412]">
            {search.trim() || smartFilter !== "all" ? "Matching documents" : "Uploaded Documents"} ({visibleDocs.length})
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCategory(null)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
                !activeCategory
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white text-[#7C6E67] border-[#E5DFD7] hover:border-[#D95D39] hover:text-[#2E2724]"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setCategory(cat.name)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
                  activeCategory === cat.name
                    ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                    : "bg-white text-[#7C6E67] border-[#E5DFD7] hover:border-[#D95D39] hover:text-[#2E2724]"
                }`}
              >
                {cat.icon} {cat.name} ({docs.filter((d) => d.doc_category === cat.name).length})
              </button>
            ))}

            {addingCategory ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const added = await addCustomCategory(newCategoryName);
                  setNewCategoryName("");
                  setAddingCategory(false);
                  if (added) setCategory(added);
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onBlur={() => { if (!newCategoryName.trim()) setAddingCategory(false); }}
                  placeholder="New category name"
                  className="text-xs px-3 py-1.5 border border-[#E5DFD7] bg-[#FCFAF7] rounded-full
                    focus:outline-none focus:ring-1 focus:ring-[#D95D39] text-[#2E2724] w-36"
                />
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 bg-[#D95D39] text-white rounded-full font-medium hover:bg-[#C24E2B]"
                >
                  Add
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingCategory(true)}
                className="text-xs px-3.5 py-1.5 rounded-full font-medium border border-dashed
                  border-[#E5DFD7] text-[#7C6E67] hover:border-[#D95D39] hover:text-[#D95D39]
                  transition-colors cursor-pointer"
              >
                + Add category
              </button>
            )}
          </div>
        </div>

        {visibleDocs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5DFD7] p-8 text-center">
            <p className="text-sm text-[#7C6E67]">
              {search.trim()
                ? `Nothing matches "${search.trim()}".`
                : smartFilter !== "all"
                ? "No documents in this state — nothing to worry about here."
                : activeCategory
                ? `No documents in ${activeCategory} yet.`
                : "No documents yet. Upload your first document to get started."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5DFD7] divide-y
            divide-[#E5DFD7]/50">
            {visibleDocs.map((doc) => {
              const health = healthFor(doc);
              const inFlight = jobs.some((j) => j.documentId === doc.id && j.stage !== "ready" && j.stage !== "failed");
              return (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3.5
                  hover:bg-[#FCFAF7] transition-colors gap-3">
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <span className="text-xl shrink-0">
                      {doc.file_type === "application/pdf" ? "📕" : "🖼️"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2E2724] truncate">{doc.file_name}</p>
                      <p className="text-xs text-[#7C6E67] truncate">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                        {doc.doc_type && (
                          <span className="ml-2 text-[#D95D39] font-medium">• {doc.doc_type}</span>
                        )}
                        {health.key === "needs_review" && (
                          <span className="ml-2 text-[#C05C7B]">
                            • {docMeta.get(doc.id)?.lowConfidenceCount} value{docMeta.get(doc.id)?.lowConfidenceCount === 1 ? "" : "s"} to confirm
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    {doc.doc_category && (
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
                        className={`hidden sm:block text-[11px] px-2 py-1 rounded-full font-medium hover:opacity-75
                          transition-opacity ${styleFor(doc.doc_category)}`}
                      >
                        {doc.doc_category}
                      </button>
                    )}
                    {health.key === "failed" && !inFlight ? (
                      <button
                        onClick={() => retryProcessing(doc)}
                        className="text-[11px] px-2 py-1 rounded-full font-semibold bg-[#FDF2EE] text-[#D95D39]
                          border border-[#F5DFD6] hover:bg-[#F5DFD6] transition-colors"
                      >
                        Couldn&apos;t read · Retry
                      </button>
                    ) : (
                      <span className={`text-[11px] px-2 py-1 rounded-full font-medium inline-flex items-center gap-1.5 ${health.badge}`}>
                        {(health.key === "processing" || inFlight) && <Spinner />}
                        {health.label}
                      </span>
                    )}
                    <button
                      onClick={() => deleteDocument(doc)}
                      className="text-[#7C6E67]/40 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {duplicatePrompt && (
        <div className="fixed inset-0 bg-[#1A1412]/30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5DFD7]">
            <h3 className="text-lg font-serif font-semibold text-[#1A1412]">
              You already have a {duplicatePrompt.docType}
            </h3>
            <p className="text-sm text-[#7C6E67] mt-1.5">
              NEXUS already has{" "}
              <span className="font-semibold text-[#2E2724]">{duplicatePrompt.existingFileName}</span>.
              Should <span className="font-semibold text-[#2E2724]">{duplicatePrompt.newFileName}</span>{" "}
              replace it, or do you want to keep both?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={replaceDuplicate}
                disabled={resolvingDuplicate}
                className="flex-1 py-2.5 bg-[#D95D39] text-white rounded-xl text-sm font-semibold
                  hover:bg-[#C24E2B] disabled:opacity-50 transition-colors shadow-sm"
              >
                {resolvingDuplicate ? "Replacing…" : "Replace the old one"}
              </button>
              <button
                onClick={() => setDuplicatePrompt(null)}
                className="px-4 py-2.5 border border-[#E5DFD7] rounded-xl text-sm font-semibold
                  text-[#2E2724] hover:bg-[#FCFAF7] transition-colors"
              >
                Keep both
              </button>
            </div>
          </div>
        </div>
      )}

      {!duplicatePrompt && categoryPrompt && (
        <div className="fixed inset-0 bg-[#1A1412]/30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5DFD7]">
            {categoryPrompt.fromUpload && (
              <div className="flex items-center gap-2 text-[11px] font-semibold mb-3">
                <span className="px-2 py-0.5 rounded-full bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]">✓ Uploaded</span>
                <span className="text-[#E5DFD7]">—</span>
                <span className="px-2 py-0.5 rounded-full bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]">✓ Read</span>
                <span className="text-[#E5DFD7]">—</span>
                <span className="px-2 py-0.5 rounded-full bg-[#D95D39] text-white">3 Choose category</span>
              </div>
            )}
            <h3 className="text-lg font-serif font-semibold text-[#1A1412]">
              {categoryPrompt.fromUpload ? "One last step: where should this live?" : "Where should we save this?"}
            </h3>
            <p className="text-sm text-[#7C6E67] mt-1.5">
              NEXUS read <span className="font-semibold text-[#2E2724]">{categoryPrompt.fileName}</span>{" "}
              and suggests <span className="font-semibold text-[#D95D39]">{categoryPrompt.suggested}</span>.
              Keep the suggestion or pick another category.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setPromptSelected(cat.name)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
                    promptSelected === cat.name
                      ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                      : "bg-white text-[#7C6E67] border-[#E5DFD7] hover:border-[#D95D39]"
                  }`}
                >
                  {cat.icon} {cat.name}
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
                    className="flex-1 text-xs px-3 py-1.5 border border-[#E5DFD7] bg-[#FCFAF7] rounded-full
                      focus:outline-none focus:ring-1 focus:ring-[#D95D39] text-[#2E2724]"
                  />
                  <button
                    type="submit"
                    className="text-xs px-3 py-1.5 bg-[#D95D39] text-white rounded-full font-medium hover:bg-[#C24E2B]"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setPromptAdding(true)}
                  className="text-xs text-[#D95D39] hover:underline font-semibold"
                >
                  + Create a new category
                </button>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={confirmCategory}
                disabled={savingPrompt}
                className="flex-1 py-2 bg-[#D95D39] text-white rounded-xl text-sm
                  font-medium hover:bg-[#C24E2B] disabled:opacity-50 transition-colors shadow-sm"
              >
                {savingPrompt ? "Saving…" : `Save to ${promptSelected}`}
              </button>
              <button
                onClick={() => { setCategoryPrompt(null); setPromptAdding(false); }}
                className="px-4 py-2 text-[#7C6E67] text-sm hover:text-[#2E2724] transition-colors"
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

function UploadJobCard({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
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
        failed ? "border-[#F5DFD6]" : done ? "border-[#E1EAD8]" : "border-[#E5DFD7]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2E2724] truncate">{job.fileName}</p>
          <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${failed ? "text-[#D95D39]" : done ? "text-[#6E885B]" : "text-[#7C6E67]"}`}>
            {!failed && !done && <Spinner />}
            {done && <span>✓</span>}
            {headline}
          </p>
          {failed && job.error && <p className="text-xs text-[#7C6E67] mt-1">{job.error}</p>}
          {done && job.summary && <p className="text-xs text-[#7C6E67] mt-1">{job.summary}</p>}
        </div>
        {(failed || done) && (
          <button onClick={onDismiss} className="text-[#7C6E67]/50 hover:text-[#2E2724] text-sm" title="Dismiss">
            ✕
          </button>
        )}
      </div>

      {job.stage === "uploading" && (
        <div className="mt-2.5 h-1.5 rounded-full bg-[#F4EFEA] overflow-hidden">
          <div
            className="h-full bg-[#D95D39] rounded-full transition-[width] duration-200"
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
                      ? "bg-[#F3F6F1] text-[#6E885B] border-[#E1EAD8]"
                      : state === "active"
                      ? "bg-[#D95D39] text-white border-[#D95D39]"
                      : "bg-white text-[#7C6E67]/50 border-[#E5DFD7]"
                  }`}
                >
                  {state === "done" ? "✓ " : ""}
                  {step.label}
                </span>
                {i < JOB_STEPS.length - 1 && <span className="text-[#E5DFD7] text-[10px]">—</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
