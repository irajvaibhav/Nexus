import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { NexusMark, NexusWordmark } from "@/components/brand";
import { DocumentsIcon, ChatIcon, ScanIcon, CalendarIcon, SparkleIcon, ArrowUpIcon, MicIcon, BellIcon, LockIcon, EyeOffIcon, ShieldCheckIcon } from "@/components/icons";

export default async function Landing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen canvas overflow-clip">
      <div aria-hidden className="blob blob-a" />
      <div aria-hidden className="blob blob-b" />
      <div aria-hidden className="blob blob-c" />

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
      <section className="relative max-w-7xl mx-auto px-6 pt-8 pb-16 lg:pt-12 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-6 items-center">
      <div className="animate-fade-in-up">
        <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E8EE] text-xs font-semibold text-[#2563EB] shadow-sm">
          <SparkleIcon className="w-3.5 h-3.5" /> Your AI life admin
        </p>
        <h1 className="mt-5 text-[40px] md:text-[52px] leading-[1.05] font-bold text-[#0F172A]">
          Your documents, remembered. Your deadlines,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#4F46E5]">handled.</span>
        </h1>
        <p className="mt-5 text-[17px] text-[#64748B] leading-relaxed max-w-md">
          Upload once. Ask anything. Never miss a renewal.
        </p>
        <div className="mt-7 flex items-center gap-3 flex-wrap">
          <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-semibold shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            Start free <span aria-hidden>→</span>
          </Link>
          <Link href="/login" className="px-7 py-3.5 rounded-full bg-white border border-[#E6E8EE] text-[#0F172A] font-semibold hover:border-[#0F172A] transition-colors">
            Sign in
          </Link>
        </div>
        <p className="mt-6 text-sm text-[#94A3B8]">Private by design. You approve before NEXUS acts.</p>
      </div>

      {/* Stage: NEXUS answering in a loop, with the other features floating around it */}
      <div id="stage" className="relative lg:pl-10 lg:pr-2 pt-6 lg:pt-0 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <div className="relative mx-auto max-w-2xl">
          <div className="card p-5 md:p-6 shadow-2xl shadow-[#0F172A]/10">
            <div className="flex items-center gap-3">
              <NexusMark size={40} />
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Good morning, Raj.</p>
                <p className="text-xs text-[#64748B]">3 documents in your vault · 1 date coming up</p>
              </div>
            </div>

            <div className="relative mt-4 h-[170px]">
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

            <div className="mt-4 grid grid-cols-3 gap-3 stagger">
              <div className="rounded-2xl border border-[#E6E8EE] bg-[#FFFBEB]/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#FFFBEB] text-[#D97706] flex items-center justify-center"><BellIcon className="w-3.5 h-3.5" /></span>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D97706]">Expiring</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">Car insurance · 6 days</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">Saturday is clear and free.</p>
              </div>
              <div className="rounded-2xl border border-[#E6E8EE] sky p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">Mumbai · week</p>
                  <span className="text-xl leading-none">🌤️</span>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {[["Tu", "🌧️"], ["We", "🌧️"], ["Th", "⛅"], ["Fr", "☀️"], ["Sa", "☀️"]].map(([d, w], i) => (
                    <div key={d} className={`rounded-md py-1 text-center ${i === 4 ? "bg-white border border-[#93C5FD]" : "bg-white/60"}`}>
                      <p className="text-[9px] font-semibold text-[#64748B]">{d}</p>
                      <p className="text-xs leading-none">{w}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E6E8EE] bg-[#FDF2F8]/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#DB2777]">Scan &amp; Fill</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">Loan application</p>
                <div className="mt-2 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div className="h-full w-[87%] rounded-full bg-gradient-to-r from-[#F97316] to-[#DB2777]" /></div>
                <p className="mt-1 text-[11px] text-[#64748B]">14 of 16 fields filled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Built for Indian paperwork</p>
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
              <Link href="/signup" className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B] transition-colors">
                Create your vault <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
              {[
                { icon: <DocumentsIcon className="w-5 h-5" />, tone: "from-[#2563EB] to-[#4F46E5]", title: "Vault", text: "Every ID, policy and statement read once and searchable." },
                { icon: <ChatIcon className="w-5 h-5" />, tone: "from-[#0EA5E9] to-[#2563EB]", title: "Ask NEXUS", text: "Type, speak or send a photo. Answers cite your documents." },
                { icon: <CalendarIcon className="w-5 h-5" />, tone: "from-[#F59E0B] to-[#EA580C]", title: "Week view", text: "Calendar, deadlines and weather on one strip. NEXUS picks the day." },
                { icon: <ScanIcon className="w-5 h-5" />, tone: "from-[#F97316] to-[#DB2777]", title: "Scan & Fill", text: "Photograph a form, get it back filled as a PDF." },
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

      {/* Privacy + closing CTA */}
      <section id="privacy" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Private by design</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0F172A]">Your documents stay yours.</h2>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
          {[
            { icon: <LockIcon className="w-5 h-5" />, tone: "from-[#2563EB] to-[#4F46E5]", t: "Private storage", d: "Only your account can read your files." },
            { icon: <EyeOffIcon className="w-5 h-5" />, tone: "from-[#0EA5E9] to-[#2563EB]", t: "Masked by default", d: "Aadhaar, PAN and account numbers stay hidden until tapped." },
            { icon: <ShieldCheckIcon className="w-5 h-5" />, tone: "from-[#16A34A] to-[#0D9488]", t: "You approve first", d: "NEXUS waits for your go-ahead. Every action is logged." },
          ].map((x) => (
            <div key={x.t} className="card card-hover p-6 text-center">
              <span className={`mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br ${x.tone} text-white flex items-center justify-center shadow-md`}>{x.icon}</span>
              <p className="mt-4 font-bold text-[#0F172A]">{x.t}</p>
              <p className="mt-1 text-sm text-[#64748B] leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 card p-8 md:p-10 text-center relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(600px_200px_at_50%_0%,_#EAF2FF_0%,_transparent_70%)]" />
          <div className="relative">
            <NexusMark size={48} className="mx-auto" />
            <h3 className="mt-5 text-2xl md:text-3xl font-bold text-[#0F172A]">Ready when you are.</h3>
            <p className="mt-2 text-[#64748B]">Free to start. Takes a minute.</p>
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-semibold shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                Start free <span aria-hidden>→</span>
              </Link>
              <Link href="/login" className="px-7 py-3.5 rounded-full bg-white border border-[#E6E8EE] text-[#0F172A] font-semibold hover:border-[#0F172A] transition-colors">
                Sign in
              </Link>
            </div>
          </div>
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
