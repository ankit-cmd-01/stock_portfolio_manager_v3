import styles from "../AdvancedFeatures.module.css";
import { formatDate } from "../../../utils/formatDate";

const SENTIMENT_ROWS = [
  { key: "positive", label: "Positive", toneClassName: "meterFillPositive" },
  { key: "neutral", label: "Neutral", toneClassName: "meterFillNeutral" },
  { key: "negative", label: "Negative", toneClassName: "meterFillNegative" },
];

export default function SentimentMeter({
  label,
  positive = 0,
  negative = 0,
  neutral = 0,
  count = 0,
  lastUpdated,
}) {
  const rowValues = {
    positive: Number(positive || 0),
    neutral: Number(neutral || 0),
    negative: Number(negative || 0),
  };

  return (
    <article className={styles.meterCard}>
      <div className={styles.meterHeader}>
        <div>
          <p className={styles.sectionEyebrow}>Overall mood</p>
          <h3 className={styles.meterTitle}>{label || "NEUTRAL"}</h3>
        </div>
        <div className={styles.meterSummary}>
          <strong>{count}</strong>
          <span>{count === 1 ? "article analyzed" : "articles analyzed"}</span>
        </div>
      </div>

      <div className={styles.meterGrid}>
        {SENTIMENT_ROWS.map((row) => (
          <div key={row.key} className={styles.meterRow}>
            <div className={styles.meterRowHeader}>
              <span>{row.label}</span>
              <strong>{rowValues[row.key].toFixed(1)}%</strong>
            </div>
            <div className={styles.meterTrack}>
              <div
                className={`${styles.meterFill} ${styles[row.toneClassName]}`}
                style={{ width: `${Math.max(0, Math.min(100, rowValues[row.key]))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className={styles.timestamp}>
        Last updated {lastUpdated ? formatDate(lastUpdated, { hour: "2-digit", minute: "2-digit" }) : "not yet"}
      </p>
    </article>
  );
}
