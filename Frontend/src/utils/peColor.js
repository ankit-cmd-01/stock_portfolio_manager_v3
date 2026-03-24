export function peColor(value) {
  const pe = Number(value);

  if (!Number.isFinite(pe)) {
    return "text-text";
  }
  if (pe > 30) {
    return "text-gold";
  }
  if (pe < 15) {
    return "text-profit";
  }
  return "text-text";
}

export function peHeatmapTone(value) {
  const pe = Number(value);

  if (!Number.isFinite(pe)) {
    return "bg-slate-800/70 text-text";
  }
  if (pe < 15) {
    return "bg-emerald-500/15 text-emerald-300";
  }
  if (pe <= 30) {
    return "bg-amber-400/12 text-amber-300";
  }
  return "bg-rose-500/15 text-rose-300";
}
