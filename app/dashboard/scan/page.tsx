"use client";

import { createClient } from "@/lib/supabase-browser";
import { ScanIcon } from "@/components/icons";
import { isSensitiveField } from "@/lib/sensitive";
import { processDocument } from "@/lib/upload";
import { useState } from "react";

const LOW_CONFIDENCE = 0.75;

type ScannedField = {
  field_label: string;
  value: string | null;
  source: string | null;
  found: boolean;
  confidence?: number;
  pdf_field_name?: string | null;
  likely_source_type: string | null;
};

type EditableField = {
  label: string;
  value: string;
  source: string | null;
  foundByNexus: boolean;
  confidence: number;
  pdfFieldName: string | null;
  likelySourceType: string | null;
  edited: boolean;
};

type Stage = "upload" | "review" | "preview" | "done";

export default function ScanFillPage() {
  const [supabase] = useState(() => createClient());
  const [stage, setStage] = useState<Stage>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [formName, setFormName] = useState("");
  const [fields, setFields] = useState<EditableField[]>([]);
  const [hasFillablePdf, setHasFillablePdf] = useState(false);
  const [fileName, setFileName] = useState("form");
  const [fileBase64, setFileBase64] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);
  const [filledBase64, setFilledBase64] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  function reset() {
    setStage("upload");
    setFields([]);
    setFormName("");
    setFileBase64("");
    setHasFillablePdf(false);
    setRevealed(new Set());
    setFilledBase64("");
    setSaveState("idle");
    setError("");
  }

  async function scanFile(file: File) {
    setError("");

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only PDF, JPG, PNG files allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB.");
      return;
    }

    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setScanning(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setScanning(false);
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setFileBase64(base64);

    try {
      const res = await fetch("/api/scan-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type, userId: user.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Scan failed");
      } else {
        setFormName(data.form_name || "this form");
        setHasFillablePdf(Boolean(data.has_fillable_fields));
        setFields(
          (data.fields || []).map((f: ScannedField) => ({
            label: f.field_label,
            value: f.found && f.value ? f.value : "",
            source: f.source,
            foundByNexus: f.found,
            confidence: typeof f.confidence === "number" ? f.confidence : f.found ? 0.5 : 0,
            pdfFieldName: f.pdf_field_name || null,
            likelySourceType: f.likely_source_type,
            edited: false,
          }))
        );
        setStage("review");
      }
    } catch {
      setError("Scan failed. Please try again.");
    }

    setScanning(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) scanFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) scanFile(file);
  }

  function updateField(index: number, value: string) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, value, edited: true, confidence: 1 } : f))
    );
  }

  function toggleReveal(index: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function copyAll() {
    const text = filledFields.map((f) => `${f.label}: ${f.value}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  async function exportFilledPdf() {
    setExporting(true);
    setError("");

    try {
      const res = await fetch("/api/scan-form/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: fileBase64,
          formName,
          fields: fields.map((f) => ({
            value: f.value.trim() || null,
            found: f.value.trim().length > 0,
            pdf_field_name: f.pdfFieldName,
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't build the filled PDF");
        return;
      }

      setFilledBase64(data.filled_pdf_base64);
      const bytes = atob(data.filled_pdf_base64);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
      const blob = new Blob([array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}-filled.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStage("done");
    } catch {
      setError("Couldn't build the filled PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // The filled PDF is the deliverable; keeping a copy in the vault means it can
  // be found, asked about and downloaded again later without re-scanning.
  async function saveToDocuments() {
    if (!filledBase64) return;
    setSaveState("saving");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("signed out");

      const bytes = atob(filledBase64);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
      const blob = new Blob([array], { type: "application/pdf" });
      const savedName = `${fileName}-filled.pdf`;
      const filePath = `${user.id}/${Date.now()}_${savedName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage.from("Documents").upload(filePath, blob, {
        contentType: "application/pdf",
      });
      if (uploadError) throw uploadError;

      const { data: row, error: dbError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          file_name: savedName,
          file_type: "application/pdf",
          file_path: filePath,
          doc_type: null,
          status: "processing",
        })
        .select()
        .single();
      if (dbError || !row) throw dbError || new Error("insert failed");

      await supabase.from("activity_log").insert({
        user_id: user.id,
        action: "scan",
        details: { message: `Saved the filled ${formName} to Documents`, document_id: row.id },
      });

      // Index it in the background so it turns up in search and Ask NEXUS.
      processDocument(row.id, () => {});
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  }

  const filledFields = fields.filter((f) => f.value.trim().length > 0);
  const blankFields = fields.filter((f) => f.value.trim().length === 0);
  const uncertainFields = fields.filter(
    (f) => f.value.trim().length > 0 && f.confidence < LOW_CONFIDENCE
  );
  // A field NEXUS could see on the page but couldn't tie to a real PDF form
  // field can't be written into the file, however it was filled in.
  const manualFields = hasFillablePdf
    ? fields.filter((f) => f.value.trim().length > 0 && !f.pdfFieldName)
    : [];

  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Scan &amp; Fill</h1>
      <p className="text-sm text-[#64748B] mt-1">
        Upload a blank form. NEXUS fills what it knows, you check the rest.
      </p>

      <Steps stage={stage} />

      {stage === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-5 border-2 border-dashed rounded-2xl p-10 text-center
            transition-colors ${
              dragOver
                ? "border-[#2563EB] bg-[#EAF2FF]"
                : "border-[#E6E8EE] bg-white hover:border-[#2563EB]/50 hover:bg-[#F8FAFC]"
            }`}
        >
          <ScanIcon className="w-9 h-9 mx-auto mb-3 text-[#2563EB]" />
          <p className="text-sm font-semibold text-[#1E293B]">
            {scanning ? "NEXUS is reading your form…" : "Drag & drop a form, or take a photo"}
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            {scanning ? "Finding the fields and matching them to your documents" : "PDF, JPG or PNG, up to 10MB"}
          </p>

          {!scanning && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <label className="inline-block px-4 py-2 bg-[#2563EB] text-white
                rounded-xl text-sm font-medium cursor-pointer hover:bg-[#1D4ED8]
                transition-colors shadow-sm">
                Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <label className="inline-block px-4 py-2 bg-white border border-[#E6E8EE] text-[#1E293B]
                rounded-xl text-sm font-medium cursor-pointer hover:border-[#2563EB] hover:bg-[#F8FAFC]
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
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {stage === "review" && (
        <div className="mt-5">
          <h2 className="text-lg font-semibold text-[#0F172A]">{formName}</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            NEXUS filled {filledFields.length} of {fields.length} fields.
            {blankFields.length > 0 && ` ${blankFields.length} need${blankFields.length === 1 ? "s" : ""} your input.`}
            {uncertainFields.length > 0 && ` ${uncertainFields.length} worth double-checking.`}
          </p>

          {uncertainFields.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
              <p className="text-sm text-[#92400E]">
                The highlighted fields are NEXUS&apos;s best guess, not a certain match. Correct
                anything that&apos;s wrong before you export.
              </p>
            </div>
          )}

          <div className="mt-4 bg-white rounded-2xl border border-[#E6E8EE] divide-y divide-[#E6E8EE]/50">
            {fields.map((field, i) => {
              const uncertain = field.value.trim().length > 0 && field.confidence < LOW_CONFIDENCE;
              const sensitive = isSensitiveField(field.label);
              const hidden = sensitive && !revealed.has(i);

              return (
                <div
                  key={i}
                  className={`px-4 py-3.5 ${uncertain ? "border-l-2 border-l-[#D97706]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[10px] font-semibold text-[#64748B]/60 font-mono uppercase tracking-wider">
                      {field.label}
                    </p>
                    <div className="flex items-center gap-2">
                      {uncertain && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                          bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                          {Math.round(field.confidence * 100)}% sure
                        </span>
                      )}
                      {field.edited && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                          bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                          your edit
                        </span>
                      )}
                      {sensitive && (
                        <button
                          onClick={() => toggleReveal(i)}
                          className="text-[11px] text-[#2563EB] hover:underline font-medium"
                        >
                          {hidden ? "Reveal" : "Hide"}
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type={hidden ? "password" : "text"}
                    value={field.value}
                    onChange={(e) => updateField(i, e.target.value)}
                    placeholder={
                      field.likelySourceType
                        ? `Usually on your ${field.likelySourceType}`
                        : "Not found. Type it in"
                    }
                    className="mt-1.5 w-full px-3 py-2 bg-[#F6F7F9] border border-[#E6E8EE] rounded-xl
                      text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent
                      text-[#1E293B] placeholder-[#64748B]/50"
                  />

                  {field.foundByNexus && field.source && !field.edited && (
                    <p className="text-[11px] text-[#64748B]/75 mt-1">From {field.source}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setStage("preview")}
              className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold
                hover:bg-[#1D4ED8] transition-colors shadow-sm"
            >
              Review the filled form
            </button>
            <button
              onClick={reset}
              className="px-4 py-2.5 border border-[#E6E8EE] rounded-xl text-sm font-medium
                text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors bg-white"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="mt-5">
          <h2 className="text-lg font-semibold text-[#0F172A]">
            This is what you&apos;ll get
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            {hasFillablePdf
              ? "You get this PDF with the values filled in, ready to print, sign or send. NEXUS sends nothing anywhere."
              : "This form has no fillable fields, so NEXUS gives you the values to copy across instead of a filled file."}
          </p>

          <div className="mt-4 bg-white rounded-2xl border border-[#E6E8EE] p-6">
            <p className="text-base font-semibold text-[#0F172A] pb-3 border-b border-[#E6E8EE]">
              {formName}
            </p>
            <dl className="mt-4 space-y-3">
              {fields.map((field, i) => {
                const manual = hasFillablePdf && field.value.trim().length > 0 && !field.pdfFieldName;
                return (
                  <div key={i} className="flex items-baseline justify-between gap-4">
                    <dt className="text-xs text-[#64748B] shrink-0 max-w-[45%]">{field.label}</dt>
                    <dd className="text-right break-words">
                      <span
                        className={`text-sm ${
                          field.value.trim()
                            ? "font-semibold text-[#1E293B]"
                            : "text-[#64748B]/50 italic"
                        }`}
                      >
                        {field.value.trim() || "left blank"}
                      </span>
                      {manual && (
                        <span className="block text-[11px] text-[#D97706] mt-0.5">
                          you&apos;ll need to write this one in yourself
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          {blankFields.length > 0 && (
            <p className="mt-3 text-xs text-[#64748B]">
              {blankFields.length} field{blankFields.length === 1 ? "" : "s"} will be left blank for
              you to complete by hand.
            </p>
          )}

          {manualFields.length > 0 && (
            <p className="mt-2 text-xs text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A]
              rounded-xl px-3 py-2">
              {manualFields.length} value{manualFields.length === 1 ? "" : "s"} can&apos;t be written
              into this PDF. NEXUS can see {manualFields.length === 1 ? "that field" : "those fields"} on
              the page, but the file has no real form field behind {manualFields.length === 1 ? "it" : "them"}.
              Copy {manualFields.length === 1 ? "it" : "them"} in by hand after downloading.
            </p>
          )}

          <div className="mt-5 flex gap-2 flex-wrap">
            {hasFillablePdf ? (
              <button
                onClick={exportFilledPdf}
                disabled={exporting}
                className="flex-1 min-w-[200px] py-2.5 bg-[#15803D] text-white rounded-xl text-sm
                  font-semibold hover:bg-[#166534] disabled:opacity-50 transition-colors shadow-sm"
              >
                {exporting ? "Preparing your PDF…" : "Approve & download the filled PDF"}
              </button>
            ) : (
              <button
                onClick={copyAll}
                disabled={filledFields.length === 0}
                className="flex-1 min-w-[200px] py-2.5 bg-[#2563EB] text-white rounded-xl text-sm
                  font-semibold hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors shadow-sm"
              >
                {copiedAll ? "Copied ✓" : "Copy all values"}
              </button>
            )}
            {hasFillablePdf && (
              <button
                onClick={copyAll}
                disabled={filledFields.length === 0}
                className="px-4 py-2.5 border border-[#E6E8EE] rounded-xl text-sm font-medium
                  text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors
                  bg-white disabled:opacity-40"
              >
                {copiedAll ? "Copied ✓" : "Copy all values"}
              </button>
            )}
            <button
              onClick={() => setStage("review")}
              className="px-4 py-2.5 border border-[#E6E8EE] rounded-xl text-sm font-medium
                text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors bg-white"
            >
              Back to edit
            </button>
          </div>

          {!hasFillablePdf && (
            <p className="mt-3 text-xs text-[#64748B]/80">
              This form has no fillable PDF fields, so NEXUS can&apos;t produce a completed copy.
              copy the values above into the form instead.
            </p>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="mt-5 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-6">
          <div className="text-center">
            <p className="text-2xl">✓</p>
            <p className="text-sm font-semibold text-[#166534] mt-2">
              Downloaded {fileName}-filled.pdf
            </p>
            <p className="text-xs text-[#166534]/80 mt-1">
              It&apos;s in your downloads folder. Sending it on is up to you.
            </p>
          </div>

          <div className="mt-5 bg-white/70 rounded-xl border border-[#BBF7D0] p-4">
            <p className="text-xs font-semibold text-[#166534] uppercase tracking-wider">What next</p>
            <ul className="mt-2 space-y-1 text-sm text-[#1E293B]">
              <li>• Print it and sign where the form asks.</li>
              <li>• Email it or upload it to the portal that requested it.</li>
              <li>• Keep a copy here so you can find it again.</li>
            </ul>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap justify-center">
            <button
              onClick={saveToDocuments}
              disabled={saveState === "saving" || saveState === "saved"}
              className="text-sm px-4 py-2 bg-[#15803D] text-white rounded-xl font-semibold
                hover:bg-[#166534] disabled:opacity-60 transition-colors shadow-sm"
            >
              {saveState === "saving"
                ? "Saving to Documents…"
                : saveState === "saved"
                ? "Saved to Documents ✓"
                : "Save a copy to Documents"}
            </button>
            <button
              onClick={reset}
              className="text-sm px-4 py-2 bg-white border border-[#E6E8EE] rounded-xl font-semibold
                text-[#1E293B] hover:border-[#2563EB] transition-colors"
            >
              Fill another form
            </button>
          </div>
          {saveState === "failed" && (
            <p className="mt-2 text-xs text-red-600 text-center">Couldn&apos;t save the copy. Try again.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Steps({ stage }: { stage: Stage }) {
  const steps = [
    { key: "upload", label: "Scan" },
    { key: "review", label: "Review" },
    { key: "preview", label: "Preview" },
    { key: "done", label: "Download" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="mt-5 flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              i === currentIndex
                ? "bg-[#2563EB] text-white border-[#2563EB]"
                : i < currentIndex
                ? "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]"
                : "bg-white text-[#64748B]/60 border-[#E6E8EE]"
            }`}
          >
            {i < currentIndex ? "✓" : i + 1} {step.label}
          </span>
          {i < steps.length - 1 && <span className="w-3 h-px bg-[#E6E8EE]" />}
        </div>
      ))}
    </div>
  );
}
