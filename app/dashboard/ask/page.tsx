"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PaperclipIcon, MicIcon, CameraIcon, ArrowUpIcon, SparkleIcon } from "@/components/icons";
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
  onerror: ((event: { error: string }) => void) | null;
};

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it from your browser's address bar, then try again.";
    case "audio-capture":
      return "No microphone found. Check that one is connected.";
    case "no-speech":
      return "Didn't catch anything. Try again, a bit closer to the mic.";
    case "network":
      return "Voice input needs an internet connection.";
    case "aborted":
      return "";
    default:
      return "Voice input stopped unexpectedly. You can type instead.";
  }
}

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
  const [attachError, setAttachError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceBlockedReason, setVoiceBlockedReason] = useState("");
  const [voiceError, setVoiceError] = useState("");
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

    // The API is only exposed on a secure origin, so opening the dev server over
    // a LAN IP silently has no speech support at all.
    if (!Recognition) {
      setVoiceBlockedReason(
        window.isSecureContext
          ? "This browser doesn't support voice input. Chrome, Edge or Safari do."
          : "Voice input only works over https or on localhost, not over a plain network address."
      );
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceError("");
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      setVoiceError(speechErrorMessage(event.error));
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    // Arriving via the "Voice" button on the floating bar: start listening
    // straight away instead of asking for a second tap.
    if (searchParams.get("voice") === "1") {
      try {
        recognition.start();
        setListening(true);
      } catch {
        // Browser refused to start without a gesture; the mic button still works.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError(voiceBlockedReason);
      return;
    }

    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }

    setVoiceError("");
    try {
      // Only mark it live once start() has actually taken, or a throw here
      // leaves the button stuck mid-listen.
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError("Voice input is still finishing the last take. Try again in a moment.");
    }
  }

  async function attachImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachError("");

    if (file.size > 10 * 1024 * 1024) {
      setAttachError("That photo is over 10MB. Try a smaller one.");
      e.target.value = "";
      return;
    }

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
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-64px)] animate-fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Ask NEXUS</h1>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-[#64748B] hover:text-[#0F172A] px-3 py-1.5
              border border-[#E6E8EE] rounded-full transition-colors bg-white font-medium"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[#64748B]/60">Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center mb-4"><SparkleIcon className="w-7 h-7" /></div>
            <h2 className="text-xl font-semibold text-[#0F172A]">What do you want to know?</h2>
            <p className="text-sm text-[#64748B] mt-1.5 max-w-sm">
              Answers come from your documents, with the source shown. You can also send a photo.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3.5 py-2 bg-white border border-[#E6E8EE] rounded-full
                    text-sm text-[#1E293B] hover:border-[#2563EB] hover:text-[#2563EB]
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
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 mb-1.5 ml-1">
                <span className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center"><SparkleIcon className="w-3.5 h-3.5" /></span>
                <span className="text-[11px] font-semibold tracking-wider text-[#0F172A]">NEXUS</span>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3.5 ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white rounded-br-md shadow-lg shadow-[#2563EB]/25"
                  : "card text-[#1E293B]"
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
                <div className="mt-3 pt-3 border-t border-[#E6E8EE]/70">
                  <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                  {msg.sources.map((s, j) => {
                    const chip = "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-[#F1F5F9] text-[#1E293B]";
                    const row = (
                      <>
                        <span>📄</span>
                        <span>{s.file_name}</span>
                        <span className="text-[#94A3B8]">p.{s.page_number}</span>
                      </>
                    );

                    return s.document_id ? (
                      <Link key={j} href={`/dashboard/documents/${s.document_id}`} className={`${chip} hover:bg-[#EAF2FF] hover:text-[#2563EB]`}>
                        {row}
                      </Link>
                    ) : (
                      <span key={j} className={chip}>{row}</span>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E6E8EE] rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#64748B]/40 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[#64748B]/40 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-[#64748B]/40 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-[#F6F7F9] pt-2">
        {attachError && (
          <p className="mb-2 text-xs text-red-600 font-medium">{attachError}</p>
        )}

        {voiceError && (
          <p className="mb-2 text-xs text-[#B45309] font-medium">{voiceError}</p>
        )}

        {listening && (
          <p className="mb-2 text-xs text-[#2563EB] font-medium">Listening… speak now.</p>
        )}

        {attachment && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white border border-[#E6E8EE]
            rounded-xl px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt="Attached" className="w-9 h-9 rounded-lg object-cover" />
            <span className="text-xs text-[#64748B]">Photo attached</span>
            <button
              onClick={() => setAttachment(null)}
              className="text-[#64748B]/50 hover:text-red-500 transition-colors text-sm px-1"
              title="Remove"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 bg-white border border-[#E6E8EE] rounded-2xl shadow-lg shadow-[#0F172A]/5 pl-4 pr-2 py-2
          focus-within:border-[#2563EB]/40 focus-within:shadow-xl transition-shadow">
          <SparkleIcon className="w-5 h-5 text-[#2563EB] shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={listening ? "Listening…" : "Ask NEXUS anything..."}
            className="flex-1 py-2 bg-transparent text-[15px] focus:outline-none text-[#1E293B] placeholder-[#94A3B8]"
          />
          <label title="Attach an image" className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
            <PaperclipIcon className="w-[22px] h-[22px]" />
            <input type="file" accept="image/*" onChange={attachImage} className="hidden" />
          </label>
          <label title="Take a photo" className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors sm:hidden">
            <CameraIcon className="w-[22px] h-[22px]" />
            <input type="file" accept="image/*" capture="environment" onChange={attachImage} className="hidden" />
          </label>
          <button
            onClick={toggleListening}
            title={!voiceSupported ? voiceBlockedReason : listening ? "Stop listening" : "Speak your question"}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              listening
                ? "bg-[#2563EB] text-white animate-pulse"
                : voiceSupported
                ? "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                : "text-[#CBD5E1]"
            }`}
          >
            <MicIcon className="w-[22px] h-[22px]" />
          </button>
          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !attachment)}
            className="w-11 h-11 rounded-xl bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors"
            aria-label="Send"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-[#94A3B8] text-center mt-2">
          Answers come from your vault. Verify important details.
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
            className="font-mono bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded
              hover:bg-[#EAF2FF] hover:text-[#2563EB] transition-colors"
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
