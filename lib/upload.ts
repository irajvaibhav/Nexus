import type { SupabaseClient } from "@supabase/supabase-js";

// supabase-js's storage.upload() gives no progress events, so the upload goes
// through XHR against the same storage endpoint it would have used.
export function uploadWithProgress(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      reject(new Error("You're signed out. Sign in and try again."));
      return;
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${bucket}/${encodedPath}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        message = body.message || body.error || message;
      } catch {
        // non-JSON error body; keep the status message
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

export type ProcessingStage =
  | "scanning"
  | "extracting"
  | "analysing"
  | "indexing"
  | "ready"
  | "failed";

export type ProcessingEvent = {
  stage: ProcessingStage;
  error?: string;
  doc_type?: string | null;
  doc_category?: string | null;
  fields_count?: number;
  deadlines_count?: number;
  duplicate_of?: { id: string; file_name: string; uploaded_at: string } | null;
};

// Reads the NDJSON progress stream from /api/process-document and reports each
// stage as it arrives. Resolves with the final event (ready or failed).
export async function processDocument(
  documentId: string,
  onStage: (event: ProcessingEvent) => void
): Promise<ProcessingEvent> {
  const res = await fetch("/api/process-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  });

  if (!res.ok || !res.body) {
    let error = "Processing failed";
    try {
      error = (await res.json()).error || error;
    } catch {
      // empty body
    }
    const failed: ProcessingEvent = { stage: "failed", error };
    onStage(failed);
    return failed;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: ProcessingEvent = { stage: "failed", error: "The connection dropped before NEXUS finished." };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          last = JSON.parse(line) as ProcessingEvent;
          onStage(last);
        } catch {
          // partial or malformed line; skip it
        }
      }
      newline = buffer.indexOf("\n");
    }
  }

  if (last.stage !== "ready" && last.stage !== "failed") {
    last = { stage: "failed", error: "The connection dropped before NEXUS finished." };
    onStage(last);
  }
  return last;
}
