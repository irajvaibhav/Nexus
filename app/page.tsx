import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { NexusMark, NexusWordmark } from "@/components/brand";
import { DocumentsIcon, ChatIcon, ScanIcon, BellIcon, HomeIcon, CheckSquareIcon, SparkleIcon, CalendarIcon, ArrowUpIcon, MicIcon } from "@/components/icons";

export default async function Landing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen bg-white overflow-x-hidden">
      <header className="relative z-10 max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <NexusWordmark />
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#1E293B]">
          <a href="#features" className="hover:text-[#2563EB]">Features</a>
          <a href="#how" className="hover:text-[#2563EB]">How it works</a>
          <a href="#privacy" className="hover:text-[#2563EB]">Privacy</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-semibold text-[#1E293B] hover:text-[#0F172A]">Login</Link>
          <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shadow-md shadow-[#2563EB]/25">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero: copy left, product right */}
      <section className="relative max-w-7xl mx-auto px-6 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10 items-center">
        <div className="animate-fade-in-up">
          <h1 className="text-[42px] md:text-[52px] leading-[1.08] font-bold text-[#0F172A] max-w-xl">
            Never miss a renewal. Never hunt for a document.{" "}
            <span className="text-[#2563EB]">Ask NEXUS.</span>
          </h1>
          <p className="mt-6 text-lg text-[#64748B] leading-relaxed max-w-lg">
            Upload your IDs, policies and statements once. NEXUS reads them, warns you
            before anything expires, picks a good day to deal with it, and fills forms for you.
          </p>
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#2563EB] text-white font-semibold shadow-lg shadow-[#2563EB]/30 hover:bg-[#1D4ED8] hover:-translate-y-0.5 transition-all">
              Get started free <span aria-hidden>→</span>
            </Link>
            <Link href="/login" className="px-6 py-3.5 rounded-xl bg-white border border-[#E6E8EE] text-[#0F172A] font-semibold hover:border-[#0F172A] transition-colors">
              I have an account
            </Link>
          </div>
          <p className="mt-10 text-sm text-[#64748B]">Private by design · Sensitive values masked · You approve before NEXUS acts</p>
        </div>

        <div className="relative animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <div aria-hidden className="absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_60%_40%,_#BFDBFE_0%,_#DBEAFE_35%,_transparent_70%)] blur-2xl opacity-90" />
          <ProductPreview />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative bg-[#F6F7F9] border-y border-[#E6E8EE]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">How it works</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0F172A] max-w-2xl">Three steps, then NEXUS does the remembering.</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 stagger">
            {[
              { n: "01", title: "Upload once", text: "Drop in a passport, a policy, a bank statement. NEXUS reads every number and date and files it for you." },
              { n: "02", title: "Ask anything", text: "“What’s my PAN?” “What do I need for a car loan?” Answers come from your own documents, source shown." },
              { n: "03", title: "Act on time", text: "Expiry dates land on your Google Calendar with reminders, timed for a day that’s free and dry." },
            ].map((s) => (
              <div key={s.n} className="card p-6">
                <span className="text-sm font-bold text-[#2563EB]">{s.n}</span>
                <p className="mt-3 text-lg font-bold text-[#0F172A]">{s.title}</p>
                <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">What you get</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0F172A] max-w-2xl">Everything your paperwork needs, in one calm place.</h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
          {[
            { icon: <DocumentsIcon className="w-5 h-5" />, tone: "from-[#2563EB] to-[#4F46E5]", title: "Vault", text: "Every ID, policy and statement read once, categorised and searchable." },
            { icon: <ChatIcon className="w-5 h-5" />, tone: "from-[#0EA5E9] to-[#2563EB]", title: "Ask NEXUS", text: "Plain-language answers from your documents. Type, speak or send a photo." },
            { icon: <CalendarIcon className="w-5 h-5" />, tone: "from-[#F59E0B] to-[#EA580C]", title: "Calendar + weather", text: "One week view: your events, your deadlines, the forecast, and the day NEXUS suggests." },
            { icon: <ScanIcon className="w-5 h-5" />, tone: "from-[#F97316] to-[#DB2777]", title: "Scan & Fill", text: "Photograph a form; NEXUS fills what it knows and hands you a completed PDF." },
          ].map((f) => (
            <div key={f.title} className="card card-hover p-5">
              <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${f.tone} text-white flex items-center justify-center shadow-md`}>{f.icon}</span>
              <p className="mt-4 text-base font-bold text-[#0F172A]">{f.title}</p>
              <p className="mt-1 text-sm text-[#64748B] leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy + CTA */}
      <section id="privacy" className="max-w-7xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white p-8 md:p-12 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">Private by design</p>
            <h2 className="mt-3 text-3xl font-bold">Your documents stay yours.</h2>
            <p className="mt-3 text-white/70 leading-relaxed max-w-lg">
              Files live in private storage only you can read. Aadhaar, PAN and account numbers stay masked
              until you tap them. Every action NEXUS takes is logged, and it never acts without your approval.
            </p>
          </div>
          <div className="flex md:justify-end">
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#0F172A] font-semibold hover:bg-[#EAF2FF] transition-colors">
              Create your vault <span aria-hidden>→</span>
            </Link>
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

// A faithful miniature of the real Home, tilted like a product shot.
function ProductPreview() {
  const days = ["Today", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const wx = ["🌤️", "🌧️", "🌧️", "⛅", "☀️", "☀️", "🌤️"];
  const temps = [29, 28, 27, 29, 30, 31, 30];
  return (
    <div
      className="relative rounded-2xl bg-white border border-[#E6E8EE] shadow-2xl shadow-[#0F172A]/15 overflow-hidden"
      style={{ transform: "perspective(1600px) rotateY(-8deg) rotateX(2deg)", transformOrigin: "left center" }}
    >
      <div className="flex">
        <aside className="w-[68px] border-r border-[#E6E8EE] py-3 flex flex-col items-center gap-1 bg-white">
          <NexusMark size={32} />
          <div className="mt-3 flex flex-col items-center gap-1 w-full px-2">
            {[
              { i: <HomeIcon className="w-4 h-4" />, l: "Home", a: true },
              { i: <DocumentsIcon className="w-4 h-4" />, l: "Vault" },
              { i: <ChatIcon className="w-4 h-4" />, l: "Ask" },
              { i: <ScanIcon className="w-4 h-4" />, l: "Fill" },
              { i: <BellIcon className="w-4 h-4" />, l: "Dates" },
              { i: <CheckSquareIcon className="w-4 h-4" />, l: "Tasks" },
            ].map((n) => (
              <div key={n.l} className={`w-full rounded-lg py-1.5 flex flex-col items-center gap-0.5 ${n.a ? "bg-[#EAF2FF] text-[#2563EB]" : "text-[#94A3B8]"}`}>
                {n.i}
                <span className="text-[8px] font-semibold">{n.l}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 bg-[#F6F7F9] p-4 space-y-3 min-w-0">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Monday, September 14</p>
            <p className="text-lg font-bold text-[#0F172A] leading-tight">Good morning, Aman.</p>
          </div>

          <div className="card px-3 py-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center"><SparkleIcon className="w-3 h-3" /></span>
            <span className="text-[10px] text-[#94A3B8] flex-1">When does my car insurance expire?</span>
            <span className="px-2 py-1 rounded-md border border-[#E6E8EE] text-[8px] font-medium text-[#1E293B] inline-flex items-center gap-1"><MicIcon className="w-2.5 h-2.5" /> Voice</span>
            <span className="w-6 h-6 rounded-lg bg-[#0F172A] text-white flex items-center justify-center"><ArrowUpIcon className="w-3 h-3" /></span>
          </div>

          <div className="card px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#FFFBEB] text-[#D97706] flex items-center justify-center text-xs">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#0F172A]">Car insurance expiring</p>
              <p className="text-[9px] text-[#64748B]">Ends in 6 days · car_insurance.pdf</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white text-[9px] font-semibold">Renew</span>
          </div>

          <div className="card p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#0F172A] inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-white flex items-center justify-center"><CalendarIcon className="w-3 h-3" /></span>
                Your week · Mumbai
              </p>
              <span className="text-[8px] px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Calendar synced</span>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {days.map((d, i) => (
                <div key={d} className={`rounded-lg border px-1 py-1.5 text-center ${i === 0 ? "border-[#93C5FD] bg-[#EAF2FF]/60" : i === 6 ? "border-[#FDE68A] bg-[#FFFBEB]/60" : "border-[#E6E8EE] bg-white"}`}>
                  <p className={`text-[7px] font-semibold uppercase ${i === 0 ? "text-[#2563EB]" : "text-[#64748B]"}`}>{d}</p>
                  <p className="text-[12px] leading-none mt-0.5">{wx[i]}</p>
                  <p className="text-[8px] text-[#1E293B]">{temps[i]}°</p>
                  <p className="text-[7px] text-[#94A3B8] mt-0.5">{i === 1 || i === 3 ? "2 evt" : i === 6 ? "•" : "free"}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-lg bg-gradient-to-r from-[#EAF2FF] to-[#EEF2FF] border border-[#CFE0FF] px-2.5 py-2 flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center shrink-0"><SparkleIcon className="w-2.5 h-2.5" /></span>
              <div className="min-w-0">
                <p className="text-[9px] text-[#1E293B] leading-snug">
                  Rain likely Tue, Wed. Best day for the renewal: <b>Saturday</b> (clear, 4% rain, nothing on your calendar).
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#0F172A] text-white text-[8px] font-semibold">Add to Google Calendar with reminders</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { l: "Scan", t: "from-[#2563EB] to-[#4F46E5]", i: <DocumentsIcon className="w-3.5 h-3.5" /> },
              { l: "Ask", t: "from-[#0EA5E9] to-[#2563EB]", i: <ChatIcon className="w-3.5 h-3.5" /> },
              { l: "Add", t: "from-[#16A34A] to-[#0D9488]", i: <CheckSquareIcon className="w-3.5 h-3.5" /> },
              { l: "Fill", t: "from-[#F97316] to-[#DB2777]", i: <ScanIcon className="w-3.5 h-3.5" /> },
            ].map((x) => (
              <div key={x.l} className="card py-2.5 flex flex-col items-center gap-1">
                <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${x.t} text-white flex items-center justify-center`}>{x.i}</span>
                <span className="text-[9px] font-bold text-[#0F172A]">{x.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
