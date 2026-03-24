export default function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton rounded-panel ${className}`.trim()} />;
}
