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
    <article className="panel hover-panel cyber-grid overflow-hidden p-4">
      <p className="break-words text-[11px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <div className="mt-4 flex min-w-0 items-end justify-between gap-4">
        <strong className={`break-words font-display text-[clamp(2rem,3vw,2.65rem)] leading-[0.9] ${accent}`}>
          {displayValue}
        </strong>
      </div>
      <p className="mt-3 break-words text-[0.98rem] leading-7 text-muted">{hint}</p>
    </article>
  );
}
