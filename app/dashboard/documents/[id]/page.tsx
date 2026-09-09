"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useParams, useRouter } from "next/navigation";
import { daysLeft, daysLabel, badgeColorFor } from "@/lib/dates";
import { docHealth, LOW_CONFIDENCE_THRESHOLD } from "@/lib/doc-status";
import { isSensitiveField, maskValue } from "@/lib/sensitive";
import { useCallback, useEffect, useState } from "react";

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

type Field = {
  id: string;
  field_name: string;
  field_value: string;
  page_number: number | null;
  confidence: number | null;
};

type Deadline = {
  id: string;
  title: string;
  expiry_date: string;
  status: string;
};

export default function DocumentDetailPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const params = useParams();
  const documentId = String(params.id);

  const [doc, setDoc] = useState<Doc | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    const [{ data: docRow }, { data: fieldRows }, { data: deadlineRows }] = await Promise.all([
      supabase.from("documents").select("*").eq("id", documentId).single(),
      supabase
        .from("document_fields")
        .select("id, field_name, field_value, page_number, confidence")
        .eq("document_id", documentId),
      supabase
        .from("deadlines")
        .select("id, title, expiry_date, status")
        .eq("document_id", documentId)
        .order("expiry_date", { ascending: true }),
    ]);

    setDoc(docRow);
    setFields(fieldRows || []);
    setDeadlines(deadlineRows || []);

    if (docRow) {
      const { data: signed } = await supabase.storage
        .from("Documents")
        .createSignedUrl(docRow.file_path, 3600);
      setPreviewUrl(signed?.signedUrl || "");
    }

    setLoading(false);
  }, [supabase, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function logActivity(message: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action: "review",
      details: { message, document_id: documentId },
    });
  }

  // A value a person has read and confirmed is no longer a guess, so it leaves
  // the review queue whether or not they changed the text.
  async function confirmField(field: Field, value: string) {
    setSaving(true);
    const trimmed = value.trim();
    const changed = trimmed !== field.field_value;

    await supabase
      .from("document_fields")
      .update({ field_value: trimmed, confidence: 1 })
      .eq("id", field.id);

    setFields((prev) =>
      prev.map((f) => (f.id === field.id ? { ...f, field_value: trimmed, confidence: 1 } : f))
    );
    await logActivity(
      changed
        ? `You corrected "${field.field_name}" on ${doc?.file_name}`
        : `You confirmed "${field.field_name}" on ${doc?.file_name}`
    );

    setEditingId(null);
    setSaving(false);
  }

  async function deleteDocument() {
    if (!doc) return;
    setDeleting(true);
    await supabase.storage.from("Documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    await logActivity(`Deleted ${doc.file_name}`);
    router.push("/dashboard/documents");
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <p className="text-sm text-[#7C6E67]/60">Loading document…</p>;
  }

  if (!doc) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-serif font-semibold text-[#1A1412]">Document not found</h1>
        <p className="text-sm text-[#7C6E67] mt-1">
          It may have been deleted.{" "}
          <Link href="/dashboard/documents" className="text-[#D95D39] hover:underline font-medium">
            Back to Documents
          </Link>
        </p>
      </div>
    );
  }

  const lowConfidenceFields = fields.filter(
    (f) => (f.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD
  );
  const health = docHealth({
    status: doc.status,
    lowConfidenceCount: lowConfidenceFields.length,
    expiryDates: deadlines.filter((d) => d.status === "active").map((d) => d.expiry_date),
  });

  return (
    <div className="max-w-4xl animate-fade-in-up">
      <Link
        href="/dashboard/documents"
        className="text-xs text-[#7C6E67] hover:text-[#D95D39] transition-colors font-medium"
      >
        ← All documents
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412] break-words">
            {doc.file_name}
          </h1>
          <p className="text-sm text-[#7C6E67] mt-1">
            {doc.doc_type && <span className="capitalize">{doc.doc_type.replace(/_/g, " ")}</span>}
            {doc.doc_type && doc.doc_category && " · "}
            {doc.doc_category}
            {(doc.doc_type || doc.doc_category) && " · "}
            Added {new Date(doc.uploaded_at).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${health.badge}`}>
          {health.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() =>
            router.push(
              `/dashboard/ask?q=${encodeURIComponent(`What does my ${doc.file_name} say?`)}`
            )
          }
          className="text-sm px-4 py-2 bg-[#D95D39] text-white rounded-xl font-medium
            hover:bg-[#C24E2B] transition-colors shadow-sm"
        >
          Ask about this
        </button>
        {previewUrl && (
          <a
            href={previewUrl}
            download={doc.file_name}
            className="text-sm px-4 py-2 border border-[#E5DFD7] bg-white text-[#2E2724] rounded-xl
              font-medium hover:border-[#D95D39] transition-colors"
          >
            Download
          </a>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-sm px-4 py-2 border border-[#E5DFD7] bg-white text-[#7C6E67] rounded-xl
            font-medium hover:border-red-300 hover:text-red-600 transition-colors"
        >
          Delete
        </button>
      </div>

      {lowConfidenceFields.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#F9DFE6] bg-[#FDF1F5]/50 px-4 py-3.5">
          <p className="text-sm font-semibold text-[#C05C7B]">
            {lowConfidenceFields.length === 1
              ? "NEXUS wasn't sure about 1 detail"
              : `NEXUS wasn't sure about ${lowConfidenceFields.length} details`}
          </p>
          <p className="text-xs text-[#7C6E67] mt-0.5">
            They&apos;re marked below. Check each one and confirm or correct it — NEXUS will use your
            version from then on.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <section>
            <h2 className="text-lg font-serif font-semibold text-[#1A1412] mb-3">
              What NEXUS found
            </h2>

            {fields.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5DFD7] p-6 text-center">
                <p className="text-sm text-[#7C6E67]">
                  {doc.status === "processing" || doc.status === "uploaded"
                    ? "NEXUS is still reading this document."
                    : "NEXUS couldn't read any details from this document."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
                {fields.map((field) => {
                  const confidence = field.confidence ?? 1;
                  const uncertain = confidence < LOW_CONFIDENCE_THRESHOLD;
                  const sensitive = isSensitiveField(field.field_name);
                  const isRevealed = revealed.has(field.id);
                  const isEditing = editingId === field.id;

                  return (
                    <div key={field.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] font-semibold text-[#7C6E67]/60 font-mono uppercase tracking-wider">
                              {field.field_name}
                            </p>
                            {uncertain && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                bg-[#FDF1F5] text-[#C05C7B] border border-[#F9DFE6]">
                                {Math.round(confidence * 100)}% sure
                              </span>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="mt-2 flex gap-2">
                              <input
                                autoFocus
                                value={draftValue}
                                onChange={(e) => setDraftValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmField(field, draftValue);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                className="flex-1 px-3 py-1.5 border border-[#E5DFD7] bg-[#FCFAF7] rounded-xl
                                  text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D39]
                                  focus:border-transparent text-[#2E2724]"
                              />
                              <button
                                onClick={() => confirmField(field, draftValue)}
                                disabled={saving || !draftValue.trim()}
                                className="text-xs px-3 py-1.5 bg-[#D95D39] text-white rounded-xl
                                  font-semibold hover:bg-[#C24E2B] disabled:opacity-40 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs px-2 py-1.5 text-[#7C6E67] hover:text-[#2E2724]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-[#2E2724] mt-0.5 break-words">
                              {sensitive && !isRevealed
                                ? maskValue(field.field_value)
                                : field.field_value}
                              {sensitive && (
                                <button
                                  onClick={() => toggleReveal(field.id)}
                                  className="ml-2 text-[11px] text-[#D95D39] hover:underline font-medium"
                                >
                                  {isRevealed ? "Hide" : "Reveal"}
                                </button>
                              )}
                            </p>
                          )}

                          <p className="text-[11px] text-[#7C6E67]/70 mt-1">
                            From {doc.file_name}
                            {field.page_number ? ` · page ${field.page_number}` : ""}
                          </p>
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {uncertain && (
                              <button
                                onClick={() => confirmField(field, field.field_value)}
                                disabled={saving}
                                className="text-xs px-2.5 py-1 rounded-xl bg-[#6E885B] text-white
                                  font-medium hover:bg-[#5C744B] transition-colors shadow-sm disabled:opacity-50"
                              >
                                Looks right
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingId(field.id);
                                setDraftValue(field.field_value);
                              }}
                              className="text-xs px-2.5 py-1 rounded-xl border border-[#E5DFD7]
                                text-[#7C6E67] hover:border-[#D95D39] hover:text-[#D95D39] transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-serif font-semibold text-[#1A1412] mb-3">Reminders</h2>
            <div className="bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
              {deadlines.length === 0 ? (
                <p className="px-4 py-5 text-sm text-[#7C6E67]/70 text-center">
                  NEXUS didn&apos;t find an expiry date on this document.
                </p>
              ) : (
                deadlines.map((d) => {
                  const days = daysLeft(d.expiry_date);
                  return (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#2E2724] truncate">{d.title}</p>
                        <p className="text-xs text-[#7C6E67]">
                          Expires {new Date(d.expiry_date).toLocaleDateString()}
                        </p>
                      </div>
                      {d.status === "active" && (
                        <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${badgeColorFor(days)}`}>
                          {daysLabel(days)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-lg font-serif font-semibold text-[#1A1412] mb-3">Preview</h2>
          <div className="bg-white rounded-2xl border border-[#E5DFD7] overflow-hidden">
            {!previewUrl ? (
              <p className="p-6 text-sm text-[#7C6E67]/70 text-center">Loading preview…</p>
            ) : doc.file_type === "application/pdf" ? (
              <iframe src={previewUrl} title={doc.file_name} className="w-full h-[420px]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={doc.file_name} className="w-full object-contain" />
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[#1A1412]/30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E5DFD7]">
            <h3 className="text-lg font-serif font-semibold text-[#1A1412]">
              Delete this document?
            </h3>
            <p className="text-sm text-[#7C6E67] mt-1.5">
              {deadlines.length > 0
                ? `This also removes ${deadlines.length} reminder${deadlines.length === 1 ? "" : "s"} and everything NEXUS extracted from it.`
                : "This also removes everything NEXUS extracted from it."}{" "}
              This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={deleteDocument}
                disabled={deleting}
                className="flex-1 py-2.5 bg-[#D95D39] text-white rounded-xl text-sm font-semibold
                  hover:bg-[#C24E2B] disabled:opacity-50 transition-colors shadow-sm"
              >
                {deleting ? "Deleting…" : "Delete document"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 text-[#7C6E67] text-sm font-medium hover:text-[#2E2724] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
