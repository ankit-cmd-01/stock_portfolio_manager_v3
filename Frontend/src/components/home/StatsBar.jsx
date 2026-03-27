import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

import SectionReveal from "./SectionReveal";

const stats = [
  { label: "Stocks Covered", suffix: "+", value: 10000 },
  { label: "Sentiment Turnaround", suffix: "s", prefix: "<", value: 2 },
  { label: "OHLCV Frequency", suffix: "h", value: 1 },
  { label: "FinBERT Accuracy", suffix: "%", value: 87 },
];

function CountNumber({ value, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!isInView) {
      return undefined;
    }

    let frameId;
    const duration = 1200;
    const start = performance.now();

    const tick = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      setCurrent(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isInView, value]);

  return (
    <span ref={ref} className="font-display text-4xl text-primary lg:text-5xl">
      {prefix}
      {current.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  return (
    <SectionReveal className="mx-auto max-w-[100rem] px-4 py-14 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-[1.6rem] border border-white/5 bg-surface px-5 py-6">
            <CountNumber {...item} />
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
