import { Bot, CandlestickChart, Clock3, Layers3, LockKeyhole, PieChart } from "lucide-react";

import SectionReveal from "./SectionReveal";

const cards = [
  {
    title: "FinBERT Sentiment",
    icon: Bot,
    body: "Classify company headlines into bullish, bearish, and neutral tone with finance-tuned language understanding.",
    visual: (
      <div className="mt-5 flex items-end gap-3">
        {[44, 28, 18].map((value, index) => (
          <div key={value} className="flex flex-1 flex-col gap-2">
            <div className="rounded-t-[1rem] bg-gradient-to-t from-primary/20 to-primary" style={{ height: `${value * 1.4}px`, opacity: 1 - index * 0.15 }} />
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
              {["Bull", "Bear", "Neutral"][index]}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "OHLCV + PE Lens",
    icon: CandlestickChart,
    body: "Read price structure and valuation side by side instead of jumping between separate charting views.",
    visual: (
      <svg viewBox="0 0 180 92" className="mt-4 h-28 w-full">
        {[24, 48, 72, 96, 120, 144].map((x, index) => (
          <g key={x}>
            <line x1={x} x2={x} y1={18 + index * 4} y2={74 - index * 3} stroke="#7b8fb7" strokeWidth="2" />
            <rect x={x - 7} y={index % 2 === 0 ? 28 : 38} width="14" height={index % 2 === 0 ? 18 : 14} fill={index % 2 === 0 ? "#00e676" : "#ff5468"} rx="3" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    title: "Multi-Basket Portfolio",
    icon: Layers3,
    body: "Separate tactical, long-term, metal, and theme baskets while keeping a unified terminal view.",
    visual: (
      <div className="mt-5 flex items-center justify-center">
        <div className="relative h-28 w-28">
          <div className="absolute inset-0 rounded-full border-[10px] border-primary/25" />
          <div className="absolute inset-3 rounded-full border-[10px] border-profit/25" />
          <div className="absolute inset-6 rounded-full border-[10px] border-gold/25" />
        </div>
      </div>
    ),
  },
  {
    title: "Groq Speed",
    icon: Clock3,
    body: "Fast inference rounds keep portfolio commentary and earnings summaries ready while context stays warm.",
    visual: (
      <div className="mt-5 rounded-[1.2rem] border border-primary/20 bg-primary/8 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Latency</p>
        <p className="mt-2 font-display text-4xl text-primary">480ms</p>
        <div className="mt-3 h-2 rounded-full bg-white/5">
          <div className="h-full w-4/5 rounded-full bg-primary" />
        </div>
      </div>
    ),
  },
  {
    title: "Telegram OTP",
    icon: LockKeyhole,
    body: "Account recovery and sign-in flows can be backed by Telegram for fast, user-friendly verification.",
    visual: (
      <div className="mt-5 flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/5 bg-white/[0.02] p-4 text-sm">
        {["Login", "OTP", "Verified"].map((item, index) => (
          <div key={item} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
              {index + 1}
            </span>
            <span className="text-text">{item}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Earnings Snapshot",
    icon: PieChart,
    body: "Put EPS actuals, estimates, and surprise context in a compact readout before you dig deeper.",
    visual: (
      <div className="mt-5 flex items-end gap-3">
        {[
          { label: "Q1", height: 38 },
          { label: "Q2", height: 52 },
          { label: "Q3", height: 44 },
          { label: "Q4", height: 66 },
        ].map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-t-[1rem] bg-gradient-to-t from-primary/20 to-primary" style={{ height: item.height }} />
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">{item.label}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function FeatureBentoGrid() {
  return (
    <SectionReveal className="mx-auto max-w-[100rem] px-4 py-14 lg:px-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.32em] text-primary">Feature matrix</p>
        <h3 className="mt-4 font-display text-4xl text-text">A bento grid of the platform’s core research surfaces.</h3>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {cards.map(({ title, icon: Icon, body, visual }) => (
          <article key={title} className="rounded-[1.8rem] border border-white/5 bg-surface p-5 transition hover:border-primary/20 hover:shadow-[0_18px_60px_rgba(0,229,255,0.08)]">
            <div className="flex items-center gap-3 text-primary">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-primary/10">
                <Icon size={18} />
              </div>
              <h4 className="font-display text-2xl text-text">{title}</h4>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted">{body}</p>
            {visual}
          </article>
        ))}
      </div>
    </SectionReveal>
  );
}
