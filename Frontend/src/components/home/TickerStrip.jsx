import { motion } from "framer-motion";

import SectionReveal from "./SectionReveal";

const rows = [
  { symbol: "TCS", ltp: "₹3,982.10", change: "+1.22%", sentiment: "Bullish" },
  { symbol: "INFY", ltp: "₹1,589.75", change: "-0.84%", sentiment: "Bearish" },
  { symbol: "RELIANCE", ltp: "₹2,965.20", change: "+0.63%", sentiment: "Neutral" },
  { symbol: "HDFCBANK", ltp: "₹1,712.90", change: "+0.41%", sentiment: "Bullish" },
  { symbol: "ITC", ltp: "₹434.55", change: "-0.27%", sentiment: "Neutral" },
  { symbol: "SBIN", ltp: "₹842.10", change: "+1.03%", sentiment: "Bullish" },
];

function sentimentTone(sentiment) {
  if (sentiment === "Bullish") {
    return "border-profit/30 bg-profit/10 text-profit";
  }
  if (sentiment === "Bearish") {
    return "border-loss/30 bg-loss/10 text-loss";
  }
  return "border-border bg-white/[0.04] text-text";
}

export default function TickerStrip({ as = "section", className = "" }) {
  const loop = [...rows, ...rows];

  return (
    <SectionReveal as={as} className={`border-y border-white/5 bg-black/15 ${className}`.trim()}>
      <div className="mx-auto max-w-[100rem] overflow-hidden px-4 py-2 lg:px-8">
        <motion.div className="marquee-track flex gap-3" style={{ "--marquee-duration": "24s" }}>
          {loop.map((row, index) => (
            <div key={`${row.symbol}-${index}`} className="flex min-w-max items-center gap-4 rounded-full border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm">
              <span className="font-semibold uppercase tracking-[0.2em] text-primary">{row.symbol}</span>
              <span className="text-text">{row.ltp}</span>
              <span className={row.change.startsWith("-") ? "text-loss" : "text-profit"}>{row.change}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${sentimentTone(row.sentiment)}`}>
                {row.sentiment}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </SectionReveal>
  );
}
