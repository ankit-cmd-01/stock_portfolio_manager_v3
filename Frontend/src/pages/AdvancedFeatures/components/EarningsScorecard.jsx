import styles from "../AdvancedFeatures.module.css";
import { formatDate } from "../../../utils/formatDate";

function formatMetric(value, options = {}) {
  if (value == null || Number.isNaN(Number(value))) {
    return "--";
  }

  return new Intl.NumberFormat("en-IN", {
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(Number(value));
}

export default function EarningsScorecard({ data }) {
  const cards = [
    ["Quarter date", data?.quarter_date ? formatDate(data.quarter_date) : "--"],
    ["EPS actual", formatMetric(data?.eps_actual)],
    ["EPS estimate", formatMetric(data?.eps_estimate)],
    ["EPS surprise %", data?.eps_surprise_pct != null ? `${formatMetric(data.eps_surprise_pct)}%` : "--"],
    ["Revenue actual", formatMetric(data?.revenue_actual, { compact: true, maximumFractionDigits: 1 })],
    ["Previous quarter revenue", formatMetric(data?.revenue_estimate, { compact: true, maximumFractionDigits: 1 })],
    [
      "Revenue change %",
      data?.revenue_surprise_pct != null ? `${formatMetric(data.revenue_surprise_pct)}%` : "--",
    ],
    ["Cache state", data?.is_cached ? (data?.is_stale ? "Stale cache" : "Cached") : "Fresh fetch"],
  ];

  return (
    <section className={styles.scoreSection}>
      <div>
        <p className={styles.sectionEyebrow}>Quarter snapshot</p>
        <h3 className={styles.scoreTitle}>Numbers that shaped the latest print</h3>
      </div>

      <div className={styles.scoreGrid}>
        {cards.map(([label, value]) => (
          <article key={label} className={styles.scoreCard}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
