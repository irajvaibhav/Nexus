import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { NexusMark, NexusWordmark } from "@/components/brand";
import { DocumentsIcon, ChatIcon, ScanIcon, CalendarIcon, SparkleIcon, ArrowUpIcon, MicIcon, BellIcon } from "@/components/icons";

export default async function Landing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen bg-[#F6F7F9] overflow-x-hidden">
      <div aria-hidden className="blob blob-a" />
      <div aria-hidden className="blob blob-b" />

      <header className="relative z-10 max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <NexusWordmark />
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#1E293B]">
          <a href="#stage" className="hover:text-[#2563EB]">See it work</a>
          <a href="#features" className="hover:text-[#2563EB]">Features</a>
          <a href="#privacy" className="hover:text-[#2563EB]">Privacy</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-semibold text-[#1E293B] hover:text-[#0F172A]">Login</Link>
          <Link href="/signup" className="px-5 py-2.5 rounded-full bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E293B] transition-colors">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-6 pt-14 pb-10 text-center animate-fade-in-up">
        <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E8EE] text-xs font-semibold text-[#2563EB] shadow-sm">
          <SparkleIcon className="w-3.5 h-3.5" /> Your AI life admin
        </p>
        <h1 className="mt-6 text-[42px] md:text-[58px] leading-[1.04] font-bold text-[#0F172A]">
          Your documents, remembered.
          <br />
          Your deadlines, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#4F46E5]">handled.</span>
        </h1>
        <p className="mt-6 text-lg text-[#64748B] leading-relaxed max-w-2xl mx-auto">
          Upload your IDs, policies and statements once. NEXUS reads every number and date,
          answers questions from them, warns you before anything expires, and picks a good day to sort it out.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-semibold shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            Start free <span aria-hidden>→</span>
          </Link>
          <Link href="/login" className="px-7 py-3.5 rounded-full bg-white border border-[#E6E8EE] text-[#0F172A] font-semibold hover:border-[#0F172A] transition-colors">
            Sign in
          </Link>
        </div>
      </section>

      {/* Stage: NEXUS answering in a loop, with the other features floating around it */}
      <section id="stage" className="relative max-w-6xl mx-auto px-6 pb-24">
        <div className="relative mx-auto max-w-3xl">
          <FloatingCard className="hidden lg:block absolute -left-60 top-10 w-64 float-a" delay="0ms">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#D97706] flex items-center justify-center"><BellIcon className="w-4 h-4" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D97706]">Expiring soon</p>
                <p className="text-sm font-semibold text-[#0F172A]">Car insurance · 6 days</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Saturday looks clear and your calendar is free. Added with reminders.</p>
          </FloatingCard>

          <FloatingCard className="hidden lg:block absolute -right-60 top-16 w-60 float-b" delay="150ms">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">Mumbai · this week</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-0.5">29°</p>
              </div>
              <span className="text-3xl">🌤️</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {[["Tue", "🌧️"], ["Wed", "🌧️"], ["Thu", "⛅"], ["Fri", "☀️"], ["Sat", "☀️"]].map(([d, w], i) => (
                <div key={d} className={`rounded-lg py-1 text-center ${i === 4 ? "bg-[#EAF2FF]" : "bg-[#F8FAFC]"}`}>
                  <p className="text-[9px] font-semibold text-[#64748B]">{d}</p>
                  <p className="text-sm leading-none">{w}</p>
                </div>
              ))}
            </div>
          </FloatingCard>

          <FloatingCard className="hidden lg:block absolute -right-60 -bottom-6 w-60 float-c" delay="300ms">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#DB2777]">Scan &amp; Fill</p>
            <p className="text-sm font-semibold text-[#0F172A] mt-0.5">Loan application</p>
            <div className="mt-2 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div className="h-full w-[87%] rounded-full bg-gradient-to-r from-[#F97316] to-[#DB2777]" /></div>
            <p className="mt-1.5 text-xs text-[#64748B]">14 of 16 fields filled from your vault</p>
          </FloatingCard>

          <div className="card p-6 md:p-8 shadow-2xl shadow-[#0F172A]/10">
            <div className="flex items-center gap-3">
              <NexusMark size={40} />
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Good morning, Raj.</p>
                <p className="text-xs text-[#64748B]">3 documents in your vault · 1 date coming up</p>
              </div>
            </div>

            <div className="relative mt-6 h-[210px]">
              {[
                { q: "What's my PAN number?", a: "Your PAN is ABCDE1234F.", src: "Test_PAN_Card.png · p.1" },
                { q: "When does my car insurance expire?", a: "It ends on 20 September, in 6 days. Saturday is clear and free if you want to renew it in person.", src: "car_insurance.pdf · p.1" },
                { q: "What do I need for a car loan?", a: "PAN, Aadhaar, 3 months of bank statements and a salary slip. You already have the first three; the salary slip is missing.", src: "3 documents matched" },
              ].map((t, i) => (
                <div key={t.q} className="qa absolute inset-0" style={{ animationDelay: `${i * 5}s` }}>
                  <div className="flex justify-end">
                    <p className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white text-sm px-4 py-2.5 shadow-lg shadow-[#2563EB]/25">{t.q}</p>
                  </div>
                  <div className="qa-answer mt-3 flex items-start gap-2.5" style={{ animationDelay: `${i * 5}s` }}>
                    <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white flex items-center justify-center shrink-0 mt-0.5"><SparkleIcon className="w-3.5 h-3.5" /></span>
                    <div className="max-w-[85%] rounded-2xl bg-[#F8FAFC] border border-[#E6E8EE] px-4 py-3">
                      <p className="text-sm text-[#0F172A] leading-relaxed">{t.a}</p>
                      <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] px-2 py-1 rounded-md bg-white border border-[#E6E8EE] text-[#1E293B]">📄 {t.src}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#E6E8EE] bg-white pl-4 pr-2 py-2">
              <SparkleIcon className="w-5 h-5 text-[#2563EB]" />
              <span className="flex-1 text-sm text-[#94A3B8]">Ask NEXUS anything about your documents…</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6E8EE] text-xs font-medium text-[#1E293B]"><MicIcon className="w-4 h-4" /> Voice</span>
              <span className="w-9 h-9 rounded-xl bg-[#0F172A] text-white flex items-center justify-center"><ArrowUpIcon className="w-4 h-4" /></span>
            </div>
          </div>
        </div>

        <p className="mt-16 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Built for Indian paperwork</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {["Aadhaar", "PAN", "Passport", "Driving licence", "Vehicle RC", "PUC", "Insurance", "Bank statements", "Rent agreements", "Form 16"].map((t) => (
            <span key={t} className="px-3 py-1.5 rounded-full bg-white border border-[#E6E8EE] text-xs font-medium text-[#1E293B]">{t}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative bg-white border-y border-[#E6E8EE]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">What NEXUS does</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0F172A]">Four jobs it takes off your plate.</h2>
              <p className="mt-4 text-[#64748B] leading-relaxed">Each one is useful alone. Together they mean you stop keeping paperwork in your head.</p>
              <Link href="/signup" className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B] transition-colors">
                Create your vault <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
              {[
                { icon: <DocumentsIcon className="w-5 h-5" />, tone: "from-[#2563EB] to-[#4F46E5]", title: "Vault", text: "Reads every ID, policy and statement once. Numbers, dates and expiry are extracted with a confidence score, so a guess never looks like a fact." },
                { icon: <ChatIcon className="w-5 h-5" />, tone: "from-[#0EA5E9] to-[#2563EB]", title: "Ask NEXUS", text: "Type, speak or send a photo. Answers come only from your documents, with the source shown, and say plainly when something is missing." },
                { icon: <CalendarIcon className="w-5 h-5" />, tone: "from-[#F59E0B] to-[#EA580C]", title: "Week view", text: "Your Google Calendar, your deadlines and the forecast on one strip. NEXUS picks a dry, free day and adds it with reminders." },
                { icon: <ScanIcon className="w-5 h-5" />, tone: "from-[#F97316] to-[#DB2777]", title: "Scan & Fill", text: "Photograph any form. NEXUS fills what it knows, flags what it isn't sure of, and hands you a completed PDF." },
              ].map((f) => (
                <div key={f.title} className="card card-hover p-5">
                  <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${f.tone} text-white flex items-center justify-center shadow-md`}>{f.icon}</span>
                  <p className="mt-4 text-base font-bold text-[#0F172A]">{f.title}</p>
                  <p className="mt-1 text-sm text-[#64748B] leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="max-w-7xl mx-auto px-6 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white p-8 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">Private by design</p>
            <h2 className="mt-3 text-3xl font-bold">Your documents stay yours.</h2>
          </div>
          {[
            { t: "Private storage", d: "Files live in storage only your account can read." },
            { t: "Masked by default", d: "Aadhaar, PAN and account numbers stay hidden until you tap them." },
            { t: "You approve first", d: "NEXUS shows what it plans to do and waits. Every action is logged." },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl bg-white/10 border border-white/10 p-5">
              <p className="font-semibold">{x.t}</p>
              <p className="mt-1 text-sm text-white/70 leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#E6E8EE]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="inline-flex items-center gap-2"><NexusMark size={22} /> NEXUS · Your AI life admin</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-[#0F172A]">Login</Link>
            <Link href="/signup" className="hover:text-[#0F172A]">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FloatingCard({ className, delay, children }: { className: string; delay: string; children: React.ReactNode }) {
  return (
    <div className={`card p-4 shadow-xl shadow-[#0F172A]/10 animate-fade-in-up ${className}`} style={{ animationDelay: delay }}>
      {children}
    </div>
  );
}
