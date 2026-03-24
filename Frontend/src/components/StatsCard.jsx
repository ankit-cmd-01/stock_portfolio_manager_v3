import { useEffect, useState } from "react";

export default function StatsCard({ label, value, hint, accent = "text-primary" }) {
  const target = Number(value);
  const [displayValue, setDisplayValue] = useState(Number.isFinite(target) ? 0 : value);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplayValue(value);
      return undefined;
    }

    let frameId;
    let start;
    const duration = 900;

    const step = (timestamp) => {
      if (!start) {
        start = timestamp;
      }
      const progress = Math.min((timestamp - start) / duration, 1);
      setDisplayValue((target * progress).toFixed(target >= 100 ? 0 : 2));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [target, value]);

  return (
    <article className="panel hover-panel cyber-grid p-5">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <strong className={`font-display text-4xl leading-none ${accent}`}>
          {displayValue}
        </strong>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{hint}</p>
    </article>
  );
}
