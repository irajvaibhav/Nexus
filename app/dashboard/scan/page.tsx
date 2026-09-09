"use client";

import { createClient } from "@/lib/supabase-browser";
import { ScanIcon } from "@/components/icons";
import { isSensitiveField } from "@/lib/sensitive";
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

  function reset() {
    setStage("upload");
    setFields([]);
    setFormName("");
    setFileBase64("");
    setHasFillablePdf(false);
    setRevealed(new Set());
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

  const filledFields = fields.filter((f) => f.value.trim().length > 0);
  const blankFields = fields.filter((f) => f.value.trim().length === 0);
  const uncertainFields = fields.filter(
    (f) => f.value.trim().length > 0 && f.confidence < LOW_CONFIDENCE
  );

  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Scan &amp; Fill</h1>
      <p className="text-sm text-[#7C6E67] mt-1">
        Photograph or upload any blank form. NEXUS fills in what it knows from your documents —
        you check it before anything leaves NEXUS.
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
                ? "border-[#D95D39] bg-[#FDF2EE]"
                : "border-[#E5DFD7] bg-white hover:border-[#D95D39]/50 hover:bg-[#FAF8F5]"
            }`}
        >
          <ScanIcon className="w-9 h-9 mx-auto mb-3 text-[#D95D39]" />
          <p className="text-sm font-semibold text-[#2E2724]">
            {scanning ? "NEXUS is reading your form…" : "Drag & drop a form, or take a photo"}
          </p>
          <p className="text-xs text-[#7C6E67] mt-1">
            {scanning ? "Finding the fields and matching them to your documents" : "PDF, JPG, PNG — Max 10MB"}
          </p>

          {!scanning && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <label className="inline-block px-4 py-2 bg-[#D95D39] text-white
                rounded-xl text-sm font-medium cursor-pointer hover:bg-[#C24E2B]
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
              <label className="inline-block px-4 py-2 bg-white border border-[#E5DFD7] text-[#2E2724]
                rounded-xl text-sm font-medium cursor-pointer hover:border-[#D95D39] hover:bg-[#FAF8F5]
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
          <h2 className="text-lg font-serif font-semibold text-[#1A1412]">{formName}</h2>
          <p className="text-xs text-[#7C6E67] mt-0.5">
            NEXUS filled {filledFields.length} of {fields.length} fields.
            {blankFields.length > 0 && ` ${blankFields.length} need${blankFields.length === 1 ? "s" : ""} your input.`}
            {uncertainFields.length > 0 && ` ${uncertainFields.length} worth double-checking.`}
          </p>

          {uncertainFields.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[#FBEAC9] bg-[#FEF9EC] px-4 py-3">
              <p className="text-sm text-[#8A6420]">
                The highlighted fields are NEXUS&apos;s best guess, not a certain match. Correct
                anything that&apos;s wrong before you export.
              </p>
            </div>
          )}

          <div className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
            {fields.map((field, i) => {
              const uncertain = field.value.trim().length > 0 && field.confidence < LOW_CONFIDENCE;
              const sensitive = isSensitiveField(field.label);
              const hidden = sensitive && !revealed.has(i);

              return (
                <div
                  key={i}
                  className={`px-4 py-3.5 ${uncertain ? "border-l-2 border-l-[#D48C2B]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[10px] font-semibold text-[#7C6E67]/60 font-mono uppercase tracking-wider">
                      {field.label}
                    </p>
                    <div className="flex items-center gap-2">
                      {uncertain && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                          bg-[#FEF9EC] text-[#D48C2B] border border-[#FBEAC9]">
                          {Math.round(field.confidence * 100)}% sure
                        </span>
                      )}
                      {field.edited && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                          bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]">
                          your edit
                        </span>
                      )}
                      {sensitive && (
                        <button
                          onClick={() => toggleReveal(i)}
                          className="text-[11px] text-[#D95D39] hover:underline font-medium"
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
                        ? `Not in your documents — usually on your ${field.likelySourceType}`
                        : "NEXUS couldn't find this — type it yourself"
                    }
                    className="mt-1.5 w-full px-3 py-2 bg-[#FCFAF7] border border-[#E5DFD7] rounded-xl
                      text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent
                      text-[#2E2724] placeholder-[#7C6E67]/50"
                  />

                  {field.foundByNexus && field.source && !field.edited && (
                    <p className="text-[11px] text-[#7C6E67]/75 mt-1">From {field.source}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setStage("preview")}
              className="flex-1 py-2.5 bg-[#D95D39] text-white rounded-xl text-sm font-semibold
                hover:bg-[#C24E2B] transition-colors shadow-sm"
            >
              Review the filled form
            </button>
            <button
              onClick={reset}
              className="px-4 py-2.5 border border-[#E5DFD7] rounded-xl text-sm font-medium
                text-[#7C6E67] hover:border-[#D95D39] hover:text-[#D95D39] transition-colors bg-white"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="mt-5">
          <h2 className="text-lg font-serif font-semibold text-[#1A1412]">
            This is what you&apos;ll get
          </h2>
          <p className="text-xs text-[#7C6E67] mt-0.5">
            Nothing has been sent anywhere. Exporting downloads a copy to your device.
          </p>

          <div className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] p-6">
            <p className="text-base font-serif font-semibold text-[#1A1412] pb-3 border-b border-[#E5DFD7]">
              {formName}
            </p>
            <dl className="mt-4 space-y-3">
              {fields.map((field, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4">
                  <dt className="text-xs text-[#7C6E67] shrink-0 max-w-[45%]">{field.label}</dt>
                  <dd
                    className={`text-sm text-right break-words ${
                      field.value.trim()
                        ? "font-semibold text-[#2E2724]"
                        : "text-[#7C6E67]/50 italic"
                    }`}
                  >
                    {field.value.trim() || "left blank"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {blankFields.length > 0 && (
            <p className="mt-3 text-xs text-[#7C6E67]">
              {blankFields.length} field{blankFields.length === 1 ? "" : "s"} will be left blank for
              you to complete by hand.
            </p>
          )}

          <div className="mt-5 flex gap-2 flex-wrap">
            {hasFillablePdf ? (
              <button
                onClick={exportFilledPdf}
                disabled={exporting}
                className="flex-1 min-w-[200px] py-2.5 bg-[#6E885B] text-white rounded-xl text-sm
                  font-semibold hover:bg-[#5C744B] disabled:opacity-50 transition-colors shadow-sm"
              >
                {exporting ? "Preparing your PDF…" : "Approve & download filled PDF"}
              </button>
            ) : (
              <button
                onClick={copyAll}
                disabled={filledFields.length === 0}
                className="flex-1 min-w-[200px] py-2.5 bg-[#D95D39] text-white rounded-xl text-sm
                  font-semibold hover:bg-[#C24E2B] disabled:opacity-40 transition-colors shadow-sm"
              >
                {copiedAll ? "Copied ✓" : "Copy all values"}
              </button>
            )}
            <button
              onClick={() => setStage("review")}
              className="px-4 py-2.5 border border-[#E5DFD7] rounded-xl text-sm font-medium
                text-[#7C6E67] hover:border-[#D95D39] hover:text-[#D95D39] transition-colors bg-white"
            >
              Back to edit
            </button>
          </div>

          {!hasFillablePdf && (
            <p className="mt-3 text-xs text-[#7C6E67]/80">
              This form has no fillable PDF fields, so NEXUS can&apos;t produce a completed copy —
              copy the values above into the form instead.
            </p>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="mt-5 rounded-2xl border border-[#E1EAD8] bg-[#F3F6F1] p-6 text-center">
          <p className="text-2xl">✓</p>
          <p className="text-sm font-semibold text-[#4A5D3D] mt-2">
            Downloaded {fileName}-filled.pdf
          </p>
          <p className="text-xs text-[#4A5D3D]/80 mt-1">
            NEXUS didn&apos;t submit this anywhere — sending it on is up to you.
          </p>
          <button
            onClick={reset}
            className="mt-4 text-sm px-4 py-2 bg-white border border-[#E5DFD7] rounded-xl font-semibold
              text-[#2E2724] hover:border-[#D95D39] transition-colors"
          >
            Fill another form
          </button>
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
    { key: "done", label: "Export" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="mt-5 flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              i === currentIndex
                ? "bg-[#D95D39] text-white border-[#D95D39]"
                : i < currentIndex
                ? "bg-[#F3F6F1] text-[#6E885B] border-[#E1EAD8]"
                : "bg-white text-[#7C6E67]/60 border-[#E5DFD7]"
            }`}
          >
            {i < currentIndex ? "✓" : i + 1} {step.label}
          </span>
          {i < steps.length - 1 && <span className="text-[#E5DFD7] text-xs">—</span>}
        </div>
      ))}
    </div>
  );
}
