// The one NEXUS mark, used by the favicon (app/icon.svg mirrors it), the
// sidebar, the auth card and the landing page.
export function NexusMark({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white shadow-lg shadow-[#1E3A8A]/30 ${className}`}
      style={{ width: size, height: size }}
      aria-label="NEXUS"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.5, height: size * 0.5 }}>
        <path d="M6 19V5l12 14V5" />
      </svg>
    </span>
  );
}

export function NexusWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <NexusMark size={36} />
      <span className="text-xl font-bold tracking-tight text-[#0F172A]" style={{ fontFamily: "var(--font-display), var(--font-sans)" }}>
        NEXUS
      </span>
    </span>
  );
}
