export default function ToggleChip({ label, checked, onChange }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-chip border border-border bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-cyan-400" />
      {label}
    </label>
  );
}
