"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { splitSensitive } from "@/lib/sensitive";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useRef, useEffect } from "react";

type Source = {
  file_name: string;
  document_id?: string;
  page_number: number;
  similarity: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  imageUrl?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export default function AskNexusPage() {
  return (
    <Suspense fallback={null}>
      <AskNexus />
    </Suspense>
  );
}

function AskNexus() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [attachment, setAttachment] = useState<{ base64: string; mimeType: string; url: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content, sources")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (history && history.length > 0) {
        setMessages(history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources || undefined,
        })));
      }

      setLoadingHistory(false);
    }
    init();
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setVoiceSupported(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      setListening(true);
      recognition.start();
    }
  }

  async function attachImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setAttachment({
      base64: dataUrl.split(",")[1],
      mimeType: file.type,
      url: dataUrl,
    });
    e.target.value = "";
  }

  async function handleSend() {
    if ((!input.trim() && !attachment) || loading) return;

    const question = input.trim();
    const image = attachment;
    setInput("");
    setAttachment(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question || "What is this?", imageUrl: image?.url },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          userId,
          image: image ? { base64: image.base64, mimeType: image.mimeType } : undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer, sources: data.sources },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    }

    setLoading(false);
  }

  async function clearChat() {
    await supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", userId);
    setMessages([]);
  }

  const quickQuestions = [
    "What's my passport number?",
    "When does my insurance expire?",
    "What documents do I need for a car loan?",
    "Which documents expire soon?",
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)] animate-fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Ask NEXUS</h1>
          <p className="text-sm text-[#7C6E67]">
            Bol do, type karo, ya photo bhejo — NEXUS dekh lega.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-[#7C6E67] hover:text-red-500 px-3 py-1.5
              border border-[#E5DFD7] rounded-xl hover:border-red-300
              transition-colors bg-white font-medium"
          >
            Clear chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[#7C6E67]/60">Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-xl font-serif font-semibold text-[#1A1412]">
              Hi! I&apos;m NEXUS
            </h2>
            <p className="text-sm text-[#7C6E67] mt-1.5 max-w-sm">
              Ask me anything about your documents, or send a photo of a form, notice or letter
              and I&apos;ll tell you what it needs.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-2 bg-white border border-[#E5DFD7] rounded-xl
                    text-sm text-[#7C6E67] hover:border-[#D95D39] hover:bg-[#FDF2EE] hover:text-[#D95D39]
                    transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3.5 shadow-sm ${
                msg.role === "user"
                  ? "bg-[#D95D39] text-white rounded-tr-none"
                  : "bg-white border border-[#E5DFD7] text-[#2E2724] rounded-tl-none"
              }`}
            >
              {msg.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.imageUrl}
                  alt="What you sent"
                  className="rounded-xl mb-2 max-h-48 w-auto"
                />
              )}

              {msg.role === "assistant" ? (
                <AnswerText text={msg.content} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E5DFD7]/50 space-y-1">
                  <p className="text-[10px] font-semibold text-[#7C6E67]/60 font-mono uppercase tracking-wider">
                    Sources
                  </p>
                  {msg.sources.map((s, j) => {
                    const row = (
                      <>
                        <span>📄</span>
                        <span className="underline-offset-2 group-hover:underline">{s.file_name}</span>
                        <span className="text-[#E5DFD7]">•</span>
                        <span>Page {s.page_number}</span>
                        <span className="ml-auto text-[10px] bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]
                          px-1.5 py-0.5 rounded-full">
                          {s.similarity}% match
                        </span>
                      </>
                    );

                    return s.document_id ? (
                      <Link
                        key={j}
                        href={`/dashboard/documents/${s.document_id}`}
                        className="group flex items-center gap-2 text-xs text-[#7C6E67] hover:text-[#D95D39] transition-colors"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div key={j} className="flex items-center gap-2 text-xs text-[#7C6E67]">
                        {row}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E5DFD7] rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#7C6E67]/40 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[#7C6E67]/40 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-[#7C6E67]/40 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-[#FCFAF7] pt-2">
        {attachment && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white border border-[#E5DFD7]
            rounded-xl px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt="Attached" className="w-9 h-9 rounded-lg object-cover" />
            <span className="text-xs text-[#7C6E67]">Photo attached</span>
            <button
              onClick={() => setAttachment(null)}
              className="text-[#7C6E67]/50 hover:text-red-500 transition-colors text-sm px-1"
              title="Remove"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <label
            title="Take a photo"
            className="px-3 py-3 bg-white border border-[#E5DFD7] rounded-xl cursor-pointer
              hover:border-[#D95D39] transition-colors text-base leading-none"
          >
            📷
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={attachImage}
              className="hidden"
            />
          </label>

          <label
            title="Attach an image"
            className="px-3 py-3 bg-white border border-[#E5DFD7] rounded-xl cursor-pointer
              hover:border-[#D95D39] transition-colors text-base leading-none"
          >
            📎
            <input
              type="file"
              accept="image/*"
              onChange={attachImage}
              className="hidden"
            />
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={listening ? "Listening…" : "Ask anything about your documents..."}
            className="flex-1 px-4 py-3 bg-white border border-[#E5DFD7] rounded-xl
              text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D39]
              focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
          />

          {voiceSupported && (
            <button
              onClick={toggleListening}
              title={listening ? "Stop listening" : "Speak your question"}
              className={`px-3 py-3 rounded-xl border transition-colors text-base leading-none ${
                listening
                  ? "bg-[#D95D39] border-[#D95D39] text-white animate-pulse"
                  : "bg-white border-[#E5DFD7] hover:border-[#D95D39]"
              }`}
            >
              🎤
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !attachment)}
            className="px-5 py-3 bg-[#D95D39] text-white rounded-xl text-sm
              font-medium hover:bg-[#C24E2B] disabled:opacity-50
              transition-colors shadow-sm"
          >
            Send
          </button>
        </div>
        <p className="text-[10px] text-[#7C6E67]/60 text-center mt-2">
          NEXUS can make mistakes. Verify important info.
        </p>
      </div>
    </div>
  );
}

function AnswerText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const segments = splitSensitive(text);

  return (
    <p className="text-sm whitespace-pre-wrap">
      {segments.map((segment, i) =>
        segment.sensitive && !revealed.has(i) ? (
          <button
            key={i}
            onClick={() => setRevealed((prev) => new Set(prev).add(i))}
            title="Tap to reveal"
            className="font-mono bg-[#F4EFEA] text-[#7C6E67] px-1.5 py-0.5 rounded
              hover:bg-[#FDF2EE] hover:text-[#D95D39] transition-colors"
          >
            •••• tap to reveal
          </button>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}
