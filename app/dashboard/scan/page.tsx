"use client";

import { createClient } from "@/lib/supabase-browser";
import { ScanIcon } from "@/components/icons";
import { useState } from "react";

type FormField = {
  field_label: string;
  value: string | null;
  source: string | null;
  found: boolean;
  likely_source_type: string | null;
};

type ScanResult = {
  form_name: string;
  fields: FormField[];
  has_fillable_fields: boolean;
  filled_field_count: number;
  filled_pdf_base64: string | null;
};

export default function ScanFillPage() {
  const [supabase] = useState(() => createClient());
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fileName, setFileName] = useState("form");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function scanFile(file: File) {
    setError("");
    setResult(null);
    setFileName(file.name.replace(/\.[^.]+$/, ""));

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
        setResult(data);
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

  function copyValue(field: FormField, index: number) {
    if (!field.value) return;
    navigator.clipboard.writeText(field.value);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  function copyAll() {
    if (!result) return;
    const text = result.fields
      .filter((f) => f.found && f.value)
      .map((f) => `${f.field_label}: ${f.value}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  function downloadFilledPdf() {
    if (!result?.filled_pdf_base64) return;
    const bytes = atob(result.filled_pdf_base64);
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
  }

  const foundCount = result?.fields.filter((f) => f.found).length || 0;
  const missingCount = result ? result.fields.length - foundCount : 0;
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Scan & Fill</h1>
      <p className="text-sm text-[#7C6E67] mt-1">
        Photograph or upload any blank form. NEXUS fills in what it knows from your documents,
        and tells you exactly what it couldn't find.
      </p>

      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-6 border-2 border-dashed rounded-2xl p-10 text-center
            transition-colors ${
              dragOver
                ? "border-[#D95D39] bg-[#FDF2EE]"
                : "border-[#E5DFD7] bg-white hover:border-[#D95D39]/50 hover:bg-[#FAF8F5]"
            }`}
        >
          <ScanIcon className="w-9 h-9 mx-auto mb-3 text-[#D95D39]" />
          <p className="text-sm font-semibold text-[#2E2724]">
            {scanning ? "NEXUS is analyzing the form..." : "Drag & drop a form, or take a photo"}
          </p>
          <p className="text-xs text-[#7C6E67] mt-1">PDF, JPG, PNG — Max 10MB</p>

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

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {result && (
        <div className="mt-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-serif font-semibold text-[#1A1412]">{result.form_name}</h2>
              <p className="text-xs text-[#7C6E67] mt-0.5">
                {foundCount} of {result.fields.length} fields filled
                {missingCount > 0 && ` · ${missingCount} need your input`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyAll}
                disabled={foundCount === 0}
                className="text-xs px-3.5 py-1.5 bg-[#D95D39] text-white rounded-xl font-medium
                  hover:bg-[#C24E2B] disabled:opacity-40 transition-colors shadow-sm"
              >
                {copiedAll ? "Copied!" : "Copy all"}
              </button>
              <button
                onClick={() => setResult(null)}
                className="text-xs px-3.5 py-1.5 border border-[#E5DFD7] rounded-xl text-[#7C6E67]
                  hover:border-[#D95D39] transition-colors"
              >
                Scan another
              </button>
            </div>
          </div>

          {result.has_fillable_fields ? (
            <div className="mt-4 rounded-2xl border border-[#E1EAD8] bg-[#F3F6F1] px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-[#4A5D3D]">
                This is a fillable PDF — NEXUS filled in {result.filled_field_count} field
                {result.filled_field_count === 1 ? "" : "s"} directly. Review the list below, then download.
              </p>
              <button
                onClick={downloadFilledPdf}
                className="text-xs px-3.5 py-2 bg-[#6E885B] text-white rounded-xl font-semibold
                  hover:bg-[#5C744B] transition-colors shadow-sm shrink-0"
              >
                Download filled PDF
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#7C6E67]/80">
              This form doesn&apos;t have fillable PDF fields, so NEXUS can&apos;t generate a completed
              copy directly — use the values below instead.
            </p>
          )}

          <div className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
            {result.fields.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-[#7C6E67]/60 font-mono uppercase tracking-wider">{f.field_label}</p>
                  {f.found ? (
                    <p className="text-sm font-semibold text-[#2E2724] truncate mt-0.5">{f.value}</p>
                  ) : (
                    <p className="text-sm text-[#D95D39] font-medium mt-0.5">
                      {f.likely_source_type
                        ? `Can't be filled — no ${f.likely_source_type} found in your documents`
                        : "Couldn't find this in your documents — please fill it in yourself"}
                    </p>
                  )}
                  {f.found && f.source && (
                    <p className="text-xs text-[#7C6E67]/75 mt-0.5">Source: {f.source}</p>
                  )}
                </div>
                {f.found && (
                  <button
                    onClick={() => copyValue(f, i)}
                    className="text-xs px-2.5 py-1 rounded-xl border border-[#E5DFD7] text-[#7C6E67]
                      hover:border-[#D95D39] hover:text-[#D95D39] transition-colors shrink-0"
                  >
                    {copiedIndex === i ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
