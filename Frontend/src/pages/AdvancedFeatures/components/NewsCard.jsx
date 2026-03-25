import { ExternalLink } from "lucide-react";

import styles from "../AdvancedFeatures.module.css";
import { formatDate } from "../../../utils/formatDate";

function sentimentTone(label) {
  if (label === "POSITIVE") {
    return styles.sentimentPositive;
  }
  if (label === "NEGATIVE") {
    return styles.sentimentNegative;
  }
  return styles.sentimentNeutral;
}

export default function NewsCard({ article }) {
  const candidates = [article.content_snippet, article.description].filter(Boolean);
  const normalizedTitle = (article.title || "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  const preview =
    candidates.find((value) => {
      const normalizedValue = value.replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
      return normalizedValue && normalizedValue !== normalizedTitle;
    }) || "Full article description is not available for this source yet.";

  return (
    <article className={styles.newsCard}>
      <div className={styles.newsCardHeader}>
        <span className={styles.sourceChip}>{article.source || "News feed"}</span>
        <span className={`${styles.sentimentPill} ${sentimentTone(article.sentiment_label)}`}>
          {article.sentiment_label || "NEUTRAL"}
        </span>
      </div>

      <h3 className={styles.newsTitle}>{article.title}</h3>
      <p className={styles.newsCopy}>{preview}</p>

      <div className={styles.newsMeta}>
        <span>{article.source_domain || "Unknown source"}</span>
        <span>{formatDate(article.published_at)}</span>
      </div>

      <a href={article.link} target="_blank" rel="noreferrer" className={styles.newsLink}>
        Read article
        <ExternalLink size={14} />
      </a>
    </article>
  );
}
