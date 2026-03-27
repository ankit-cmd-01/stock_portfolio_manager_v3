import SectionReveal from "./SectionReveal";

const steps = [
  {
    step: "01",
    title: "Build Portfolio",
    body: "Create custom baskets or seed them from market themes, sectors, and investor ideas.",
    color: "#00e5ff",
  },
  {
    step: "02",
    title: "Scan Signals",
    body: "Pull sentiment, valuation, momentum, and ticker-level alerts into a single surface.",
    color: "#75f0a2",
  },
  {
    step: "03",
    title: "Analyze Context",
    body: "Open charts, earnings snapshots, news tone, and AI commentary around each symbol.",
    color: "#ffd54a",
  },
];

export default function HowItWorks3D() {
  return (
    <SectionReveal className="mx-auto max-w-[100rem] px-4 pb-14 pt-14 lg:px-8 lg:pt-16">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.32em] text-primary">How it works</p>
        <h3 className="mt-4 font-display text-4xl text-text">A guided path from basket setup to investor context.</h3>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-surface p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          {steps.map((item) => (
            <article
              key={item.step}
              className="relative flex min-h-[19rem] flex-col overflow-hidden rounded-[1.8rem] border border-white/5 bg-[#07101f] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:min-h-[22rem] lg:p-8"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_85%,rgba(0,229,255,0.12),transparent_28%),linear-gradient(180deg,rgba(0,8,22,0.1),rgba(0,0,0,0.18))]" />
              <div
                className="absolute inset-y-0 right-10 w-px opacity-70"
                style={{ background: `linear-gradient(180deg, transparent 0%, ${item.color}55 18%, ${item.color} 50%, ${item.color}44 82%, transparent 100%)` }}
              />

              <div className="relative z-10">
                <p className="text-4xl font-light tracking-tight lg:text-5xl" style={{ color: item.color }}>
                  {item.step}
                </p>
              </div>

              <div className="relative z-10 mt-8 space-y-4">
                <h4 className="max-w-[10ch] font-display text-3xl leading-[1.05] text-text lg:text-[2.35rem]">{item.title}</h4>
                <p className="max-w-[24ch] text-[0.98rem] leading-7 text-[#b8c7df] lg:text-lg">
                  {item.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}
