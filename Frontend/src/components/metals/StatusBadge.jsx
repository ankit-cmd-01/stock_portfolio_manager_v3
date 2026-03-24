export default function StatusBadge({ label, tone = "neutral" }) {
  const classes =
    tone === "positive"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : tone === "negative"
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : "bg-white/10 text-muted";

  return <span className={`rounded-chip px-3 py-1 text-xs font-semibold uppercase tracking-widest ${classes}`}>{label}</span>;
}
