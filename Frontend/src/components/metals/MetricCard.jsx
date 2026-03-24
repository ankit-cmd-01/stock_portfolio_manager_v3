const metricTone = {
  positive: "text-profit",
  negative: "text-loss",
  neutral: "text-muted",
};

export default function MetricCard({ label, value, sublabel, tone = "neutral" }) {
  return (
    <article className="panel p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-3 font-display text-2xl ${metricTone[tone]}`}>{value}</p>
      {sublabel ? <p className="mt-2 text-xs uppercase tracking-widest text-muted">{sublabel}</p> : null}
    </article>
  );
}
