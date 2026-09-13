import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { NexusMark, NexusWordmark } from "@/components/brand";
import { DocumentsIcon, ChatIcon, ScanIcon, BellIcon } from "@/components/icons";

export default async function Landing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen bg-[#F6F7F9] overflow-hidden">
      {/* Slow ambient motion behind everything, kept faint so text stays crisp */}
      <div aria-hidden className="blob blob-a" />
      <div aria-hidden className="blob blob-b" />

      <header className="relative max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <NexusWordmark />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-semibold text-[#1E293B] hover:text-[#0F172A]">Sign in</Link>
          <Link href="/signup" className="px-4 py-2 rounded-full bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E293B] transition-colors">
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative max-w-6xl mx-auto px-6">
        <section className="pt-16 pb-14 text-center animate-fade-in-up">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E8EE] text-xs font-semibold text-[#2563EB]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" /> Your AI life admin
          </p>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold text-[#0F172A] leading-[1.05] max-w-3xl mx-auto">
            Your paperwork, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#4F46E5]">handled.</span>
          </h1>
          <p className="mt-5 text-lg text-[#64748B] max-w-2xl mx-auto leading-relaxed">
            Upload your documents once. NEXUS reads them, remembers every number and date,
            warns you before anything expires, picks a good day to deal with it, and fills forms for you.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="px-6 py-3.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-semibold shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Create your vault
            </Link>
            <Link href="/login" className="px-6 py-3.5 rounded-full bg-white border border-[#E6E8EE] text-[#0F172A] font-semibold hover:border-[#0F172A] transition-colors">
              I have an account
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#94A3B8]">Private by design. You approve before NEXUS acts.</p>
        </section>

        {/* A miniature of the product, so the promise is concrete */}
        <section className="card p-2 md:p-3 shadow-2xl shadow-[#0F172A]/10 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <div className="rounded-2xl bg-[#F6F7F9] border border-[#E6E8EE] p-6 grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
            <div className="space-y-3">
              <div className="card px-4 py-3 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#FFFBEB] text-[#D97706] flex items-center justify-center">📅</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">Car insurance expiring</p>
                  <p className="text-xs text-[#64748B]">Ends in 12 days · Saturday looks clear, 8% rain</p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white text-xs font-semibold">Add to calendar</span>
              </div>
              <div className="card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">Ask NEXUS</p>
                <p className="text-sm text-[#0F172A] mt-1">&ldquo;What&rsquo;s my passport number?&rdquo;</p>
                <p className="text-sm text-[#1E293B] mt-1">P1234567, expires 14 Jan 2027.</p>
                <span className="inline-block mt-2 text-[11px] px-2 py-1 rounded-md bg-[#F1F5F9] text-[#1E293B]">📄 passport.pdf · p.1</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="card sky p-4">
                <p className="text-sm font-semibold text-[#0F172A]">Mumbai</p>
                <p className="text-3xl font-bold text-[#0F172A] mt-1">29°</p>
                <p className="text-xs text-[#64748B]">Partly cloudy · best errand day: Sat</p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#DB2777]">Scan &amp; Fill</p>
                <p className="text-sm text-[#0F172A] mt-1">Loan application</p>
                <p className="text-xs text-[#64748B]">14 of 16 fields filled from your vault</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: <DocumentsIcon className="w-5 h-5" />, tone: "from-[#2563EB] to-[#4F46E5]", title: "Vault", text: "Every ID, policy and statement read once and searchable forever." },
            { icon: <ChatIcon className="w-5 h-5" />, tone: "from-[#0EA5E9] to-[#2563EB]", title: "Ask NEXUS", text: "Plain-language answers from your own documents, source shown." },
            { icon: <BellIcon className="w-5 h-5" />, tone: "from-[#F59E0B] to-[#EA580C]", title: "Calendar + weather", text: "Expiry dates on your calendar, timed for a day that's free and dry." },
            { icon: <ScanIcon className="w-5 h-5" />, tone: "from-[#F97316] to-[#DB2777]", title: "Scan & Fill", text: "Photograph a form; NEXUS fills what it knows, you check the rest." },
          ].map((f, i) => (
            <div key={f.title} className="card card-hover p-5 animate-fade-in-up" style={{ animationDelay: `${200 + i * 80}ms` }}>
              <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${f.tone} text-white flex items-center justify-center shadow-md`}>{f.icon}</span>
              <p className="mt-4 text-base font-bold text-[#0F172A]">{f.title}</p>
              <p className="mt-1 text-sm text-[#64748B] leading-relaxed">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative max-w-6xl mx-auto px-6 pb-10 flex items-center justify-between text-xs text-[#94A3B8]">
        <span className="inline-flex items-center gap-2"><NexusMark size={22} /> NEXUS</span>
        <span>Encrypted storage · Sensitive values masked · Every action logged</span>
      </footer>
    </div>
  );
}
