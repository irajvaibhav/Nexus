"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { mergeCategories, type CustomCategoryRow } from "@/lib/categories";
import { docHealth, LOW_CONFIDENCE_THRESHOLD, type HealthKey } from "@/lib/doc-status";
import { daysLeft } from "@/lib/dates";
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
};

type DuplicatePrompt = {
  newDocumentId: string;
  newFileName: string;
  docType: string;
  existingId: string;
  existingFileName: string;
};

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
  const [uploading, setUploading] = useState(false);
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

    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${user.id}/${timestamp}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("Documents")
      .upload(filePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

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
      setError(dbError?.message || "Failed to save document");
      setUploading(false);
      return;
    }

    setUploading(false);
    await loadDocs();
    logActivity("upload", `Uploaded ${file.name}`, dbData.id);

    fetch("/api/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: dbData.id, userId: user.id }),
    })
      .then(async (res) => {
        const data = await res.json();
        await loadDocs();

        if (!res.ok) {
          setError(data.error || "Processing failed");
          return;
        }

        if (data.duplicate_of) {
          setDuplicatePrompt({
            newDocumentId: dbData.id,
            newFileName: file.name,
            docType: (data.doc_type || "document").replace(/_/g, " "),
            existingId: data.duplicate_of.id,
            existingFileName: data.duplicate_of.file_name,
          });
        }

        if (data.doc_category) {
          setPromptSelected(data.doc_category);
          setCategoryPrompt({
            documentId: dbData.id,
            fileName: file.name,
            suggested: data.doc_category,
          });
        }
      })
      .catch(() => setError("Processing failed"));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  async function deleteDocument(doc: Doc) {
    await supabase.storage.from("Documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
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
      await supabase.storage.from("Documents").remove([old.file_path]);
      await supabase.from("documents").delete().eq("id", old.id);
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
          {uploading ? "Uploading..." : "Drag & drop your document here"}
        </p>
        <p className="text-xs text-[#7C6E67] mt-1">PDF, JPG, PNG — Max 10MB</p>
        <label className="inline-block mt-4 px-4 py-2 bg-[#D95D39] text-white
          rounded-xl text-sm font-medium cursor-pointer hover:bg-[#C24E2B]
          transition-colors shadow-sm">
          Browse files
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
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
                          });
                        }}
                        title="Change category"
                        className={`hidden sm:block text-[11px] px-2 py-1 rounded-full font-medium hover:opacity-75
                          transition-opacity ${styleFor(doc.doc_category)}`}
                      >
                        {doc.doc_category}
                      </button>
                    )}
                    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${health.badge}`}>
                      {health.label}
                    </span>
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
            <h3 className="text-lg font-serif font-semibold text-[#1A1412]">
              Where should we save this?
            </h3>
            <p className="text-sm text-[#7C6E67] mt-1.5">
              NEXUS looked at <span className="font-semibold text-[#2E2724]">{categoryPrompt.fileName}</span>{" "}
              and suggests <span className="font-semibold text-[#D95D39]">{categoryPrompt.suggested}</span>.
              Pick a category, or keep the suggestion.
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
                {savingPrompt ? "Saving..." : `Save to ${promptSelected}`}
              </button>
              <button
                onClick={() => { setCategoryPrompt(null); setPromptAdding(false); }}
                className="px-4 py-2 text-[#7C6E67] text-sm hover:text-[#2E2724] transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
