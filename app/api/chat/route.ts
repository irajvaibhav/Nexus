import { createClient } from "@supabase/supabase-js";
import { generateEmbedding, generateDocumentChecklist } from "@/lib/gemini";
import { detectConflicts, questionTargetsConflictLabel } from "@/lib/conflicts";
import { isDocumentChecklistQuestion } from "@/lib/checklist";
import { getAuthedUser } from "@/lib/require-user";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

type Chunk = { chunk_text: string; document_id: string; page_number: number; similarity: number };
type Attachment = { base64: string; mimeType: string };

const entityTypeKeywords: Record<string, string> = {
  car: "Vehicle", vehicle: "Vehicle", bike: "Vehicle", scooter: "Vehicle",
  property: "Property", house: "Property", flat: "Property", apartment: "Property",
  company: "Organization", organisation: "Organization", organization: "Organization", employer: "Organization",
  family: "Person",
};

async function getRelatedChunks(question: string, userId: string): Promise<Chunk[]> {
  const { data: entities } = await supabase
    .from("entities")
    .select("id, name, entity_type")
    .eq("user_id", userId);

  if (!entities || entities.length === 0) return [];

  const lower = question.toLowerCase();
  const matchedType = Object.entries(entityTypeKeywords).find(([kw]) => lower.includes(kw))?.[1] || null;

  const matchedEntities = entities.filter(
    (e) => e.entity_type === matchedType || lower.includes(e.name.toLowerCase())
  );
  if (matchedEntities.length === 0) return [];

  const { data: links } = await supabase
    .from("entity_documents")
    .select("document_id")
    .in("entity_id", matchedEntities.map((e) => e.id))
    .eq("user_id", userId);

  const documentIds = [...new Set((links || []).map((l) => l.document_id))];
  if (documentIds.length === 0) return [];

  const [{ data: docs }, { data: fields }] = await Promise.all([
    supabase.from("documents").select("id, file_name, doc_type").in("id", documentIds).eq("user_id", userId),
    supabase.from("document_fields").select("document_id, field_name, field_value").in("document_id", documentIds).eq("user_id", userId),
  ]);

  return (docs || []).map((doc) => {
    const docFields = (fields || []).filter((f) => f.document_id === doc.id);
    const fieldsText = docFields.map((f) => `${f.field_name}: ${f.field_value}`).join("\n");
    return {
      chunk_text: `${doc.doc_type || "document"}\n${fieldsText}`,
      document_id: doc.id,
      page_number: 1,
      similarity: 1,
    };
  });
}

async function logChatTurn(question: string, answer: string, sources: unknown, userId: string) {
  await supabase.from("chat_messages").insert([
    { user_id: userId, role: "user", content: question },
    { user_id: userId, role: "assistant", content: answer, sources },
  ]);

  await supabase.from("activity_log").insert({
    user_id: userId,
    action: "chat",
    details: { message: `You asked: "${question}"` },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser();
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authedUser.id;

    const { question, image } = await request.json();

    if (!question && !image) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const attachment: Attachment | null =
      image?.base64 && image?.mimeType
        ? { base64: image.base64, mimeType: image.mimeType }
        : null;

    if (attachment) {
      return await buildImageResponse(question || "", attachment, userId);
    }

    const targetLabel = questionTargetsConflictLabel(question);
    if (targetLabel) {
      const { data: fields } = await supabase
        .from("document_fields")
        .select("document_id, field_name, field_value")
        .eq("user_id", userId);

      const conflict = detectConflicts(fields || []).find((c) => c.label === targetLabel);

      if (conflict) {
        const docIds = conflict.entries.map((e) => e.document_id);
        const { data: docs } = await supabase.from("documents").select("id, file_name").in("id", docIds);
        const docMap = new Map(docs?.map((d: { id: string; file_name: string }) => [d.id, d.file_name]) || []);

        const lines = conflict.entries
          .map((e) => `- "${e.value}" (from ${docMap.get(e.document_id) || "Unknown"})`)
          .join("\n");
        const answer = `I found conflicting information for your ${conflict.label}:\n${lines}\n\nWhich one should I use?`;
        const sources = conflict.entries.map((e) => ({
          file_name: docMap.get(e.document_id) || "Unknown",
          document_id: e.document_id,
          page_number: 1,
          similarity: 100,
        }));

        await logChatTurn(question, answer, sources, userId);
        return NextResponse.json({ answer, sources, conflict: true });
      }
    }

    if (isDocumentChecklistQuestion(question)) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, file_name, doc_type, doc_category")
        .eq("user_id", userId);

      const existingDocsText = (docs || [])
        .map((d: { file_name: string; doc_type: string | null; doc_category: string | null }) =>
          `- ${d.file_name}${d.doc_type ? ` (${d.doc_type}` : ""}${d.doc_category ? `, ${d.doc_category})` : d.doc_type ? ")" : ""}`
        )
        .join("\n");

      const result = await generateDocumentChecklist(question, existingDocsText);
      const matchedFiles = new Set<string>(result.matched_files || []);
      const sources = (docs || [])
        .filter((d: { file_name: string }) => matchedFiles.has(d.file_name))
        .map((d: { id: string; file_name: string }) => ({
          file_name: d.file_name,
          document_id: d.id,
          page_number: 1,
          similarity: 100,
        }));

      await logChatTurn(question, result.answer, sources, userId);
      return NextResponse.json({ answer: result.answer, sources });
    }

    const questionEmbedding = await generateEmbedding(question);

    const [{ data: chunks, error: rpcError }, relatedChunks] = await Promise.all([
      supabase.rpc("match_documents", {
        query_embedding: JSON.stringify(questionEmbedding),
        match_user_id: userId,
        match_count: 5,
      }),
      getRelatedChunks(question, userId),
    ]);

    if (rpcError) throw rpcError;

    const seenDocIds = new Set((chunks || []).map((c: Chunk) => c.document_id));
    const merged = [
      ...(chunks || []),
      ...relatedChunks.filter((c) => !seenDocIds.has(c.document_id)),
    ];

    if (merged.length === 0) {
      return NextResponse.json({
        answer: "I don't have any documents to answer from yet. Please upload some documents first.",
        sources: [],
      });
    }

    return await buildResponse(question, merged, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function buildImageResponse(question: string, attachment: Attachment, userId: string) {
  const [{ data: fields }, { data: docs }] = await Promise.all([
    supabase
      .from("document_fields")
      .select("document_id, field_name, field_value")
      .eq("user_id", userId),
    supabase.from("documents").select("id, file_name").eq("user_id", userId),
  ]);

  const docMap = new Map(
    (docs || []).map((d: { id: string; file_name: string }) => [d.id, d.file_name])
  );

  const knownInfo = (fields || [])
    .map((f: { document_id: string; field_name: string; field_value: string }) =>
      `- ${f.field_name}: ${f.field_value} (from ${docMap.get(f.document_id) || "Unknown"})`
    )
    .join("\n");

  const prompt = `You are NEXUS, an AI life-administration assistant. The user has sent you a photo. Read it carefully and help them with it.

KNOWN INFORMATION FROM THE USER'S OWN DOCUMENTS:
${knownInfo || "(they haven't uploaded any documents yet)"}

USER'S QUESTION: ${question || "What is this, and what do I need to do about it?"}

RULES:
- Answer based on what is actually visible in the photo.
- If it's a form, list the fields it asks for. For each, say whether the KNOWN INFORMATION above already answers it - naming the document it came from - or whether the user needs to supply it themselves.
- If it's a notice, bill or letter, summarize what it says and state any deadline or action it requires, but only if that is actually printed on it.
- NEVER invent a value that is not visible in the photo or listed in the KNOWN INFORMATION.
- If the photo is too blurry or cropped to read, say so plainly instead of guessing.
- Keep it concise and direct. Do not use markdown formatting like ** or #.

Answer:`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } },
  ]);
  const answer = result.response.text();

  const sources = (docs || [])
    .filter((d: { file_name: string }) => answer.includes(d.file_name))
    .map((d: { id: string; file_name: string }) => ({
      file_name: d.file_name,
      document_id: d.id,
      page_number: 1,
      similarity: 100,
    }));

  await logChatTurn(
    question ? `${question} 📷` : "📷 Sent a photo",
    answer,
    sources,
    userId
  );

  return NextResponse.json({ answer, sources });
}

async function buildResponse(question: string, chunks: Chunk[], userId: string) {
  const docIds = [...new Set(chunks.map((c) => c.document_id))];
  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name")
    .in("id", docIds);

  const docMap = new Map(
    docs?.map((d: { id: string; file_name: string }) => [d.id, d.file_name]) || []
  );

  const context = chunks
    .map((c) => {
      const fileName = docMap.get(c.document_id) || "Unknown";
      return `[Source: ${fileName}, Page ${c.page_number}]\n${c.chunk_text}`;
    })
    .join("\n\n---\n\n");

  const prompt = `You are NEXUS, an AI document assistant. Answer the user's question using ONLY the document context provided below.

RULES:
- ONLY use information from the provided context
- If the answer is not in the context, say "I couldn't find this information in your documents"
- NEVER guess or make up information
- Always mention which document the information came from
- Keep answers concise and direct
- For sensitive info (PAN, passport, account numbers), show the full value from the document
- Do not use markdown formatting like ** in your answers

DOCUMENT CONTEXT:
${context}

USER QUESTION: ${question}

Answer:`;

  const result = await model.generateContent(prompt);
  const answer = result.response.text();

  const sources = chunks.map((c) => ({
    file_name: docMap.get(c.document_id) || "Unknown",
    document_id: c.document_id,
    page_number: c.page_number,
    similarity: Math.round(c.similarity * 100),
  }));

  const uniqueSources = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.file_name === s.file_name) === i
  );

  await logChatTurn(question, answer, uniqueSources, userId);

  return NextResponse.json({
    answer,
    sources: uniqueSources,
  });
}