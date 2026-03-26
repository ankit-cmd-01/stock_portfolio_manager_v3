import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { formatPrice } from "../utils/formatPrice";

function pillTone(value) {
  if (value === "BUY" || value === "POSITIVE") {
    return "border-profit/30 bg-profit/10 text-profit";
  }
  if (value === "SELL" || value === "NEGATIVE") {
    return "border-loss/30 bg-loss/10 text-loss";
  }
  return "border-border bg-white/5 text-text";
}

function formatPercent(value, digits = 2, signed = false) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  const prefix = signed && numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(digits)}%`;
}

export default function PortfolioStocksTable({
  rows,
  deletingId,
  onDelete,
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] border-collapse">
          <thead className="bg-white/5">
            <tr>
              {[
                "Company",
                "Price",
                "Min",
                "Max",
                "Predicted",
                "Change",
                "Signal",
                "Confidence",
                "Discount",
                "Sentiment",
                "Action",
              ].map((column) => (
                <th key={column} className="px-4 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-muted">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">
                  No stocks available for this view.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.user_stock_id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-display text-lg text-text">{row.company_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-widest text-primary">{row.ticker}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-text">{formatPrice(row.price)}</td>
                  <td className="px-4 py-4 text-sm text-muted">{formatPrice(row.min_price)}</td>
                  <td className="px-4 py-4 text-sm text-muted">{formatPrice(row.max_price)}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-text">{formatPrice(row.predicted_price)}</td>
                  <td
                    className={`px-4 py-4 text-sm font-semibold ${
                      Number(row.change_pct) >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatPercent(row.change_pct, 2, true)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-chip border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${pillTone(row.signal)}`}>
                      {row.signal}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-text">{formatPercent(row.confidence_pct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-text">{formatPercent(row.discount_pct)}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[130px]">
                      <span className={`rounded-chip border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${pillTone(row.sentiment)}`}>
                        {row.sentiment}
                      </span>
                      <p className="mt-2 text-xs text-muted">{row.news_count} ET stories</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/advanced/${encodeURIComponent(row.ticker)}`}
                        className="text-sm font-semibold text-primary transition hover:translate-x-1"
                      >
                        View Analysis
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete(row.user_stock_id)}
                        disabled={deletingId === row.user_stock_id}
                        aria-label={`Delete ${row.ticker}`}
                        className="rounded-chip border border-white/10 p-2 text-muted transition hover:border-loss/40 hover:text-loss disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
