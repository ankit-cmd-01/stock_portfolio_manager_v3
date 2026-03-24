export default function CorrelationCell({ value }) {
  const number = Number(value);
  let tone = "bg-white/5 text-text";

  if (number > 0.75) tone = "bg-emerald-900/80 text-emerald-100";
  else if (number > 0.5) tone = "bg-emerald-800/70 text-emerald-100";
  else if (number > 0.25) tone = "bg-emerald-700/60 text-emerald-50";
  else if (number < -0.75) tone = "bg-red-900/80 text-red-100";
  else if (number < -0.5) tone = "bg-red-800/70 text-red-100";
  else if (number < -0.25) tone = "bg-red-700/60 text-red-50";

  return <td className={`px-3 py-2 text-center text-sm ${tone}`}>{Number.isFinite(number) ? number.toFixed(2) : "--"}</td>;
}
