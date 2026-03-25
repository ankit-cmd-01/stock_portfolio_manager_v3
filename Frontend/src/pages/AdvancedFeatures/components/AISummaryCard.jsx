import styles from "../AdvancedFeatures.module.css";

export default function AISummaryCard({ summary, model }) {
  const paragraphs = String(summary || "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <section className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <div>
          <p className={styles.sectionEyebrow}>AI summary</p>
          <h3 className={styles.summaryTitle}>Investor-ready readout</h3>
        </div>
        <span className={styles.summaryBadge}>{model || "Unknown model"}</span>
      </div>

      <div className={styles.summaryBody}>
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        ) : (
          <p>No summary is available for this earnings snapshot yet.</p>
        )}
      </div>
    </section>
  );
}
