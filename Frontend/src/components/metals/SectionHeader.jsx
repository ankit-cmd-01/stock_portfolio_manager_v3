export default function SectionHeader({ label, title, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
        <h2 className="mt-2 font-display text-3xl text-text">{title}</h2>
      </div>
      {action}
    </div>
  );
}
