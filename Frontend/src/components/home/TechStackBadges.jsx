import SectionReveal from "./SectionReveal";

const badges = [
  { label: "React", tip: "Interface layer and route shell" },
  { label: "Django", tip: "REST backend and auth" },
  { label: "FinBERT", tip: "Finance-tuned sentiment classification" },
  { label: "Groq", tip: "Fast AI inference pipeline" },
  { label: "yfinance", tip: "Historical and market ingestion" },
  { label: "PostgreSQL", tip: "Primary data storage path" },
  { label: "Telegram", tip: "OTP and account flow support" },
  { label: "Vite", tip: "Fast local frontend workflow" },
];

export default function TechStackBadges() {
  return (
    <SectionReveal className="mx-auto max-w-[100rem] px-4 py-14 lg:px-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.32em] text-primary">Tech stack</p>
        <h3 className="mt-4 font-display text-4xl text-text">The tools powering the terminal.</h3>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="flex min-w-max gap-4 pb-2">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className="group relative rounded-[1.4rem] border border-white/5 bg-surface px-5 py-4 transition hover:border-primary/50 hover:shadow-[0_0_24px_rgba(0,229,255,0.18)]"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text">{badge.label}</p>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-48 -translate-x-1/2 rounded-panel border border-primary/20 bg-[#0d1628] px-3 py-2 text-xs leading-5 text-muted shadow-[0_12px_30px_rgba(0,0,0,0.32)] group-hover:block">
                {badge.tip}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}
