import styles from "../AdvancedFeatures.module.css";

export default function IncrementalBadge({ count }) {
  if (!count) {
    return null;
  }

  return <span className={styles.incrementalBadge}>+{count} new</span>;
}
