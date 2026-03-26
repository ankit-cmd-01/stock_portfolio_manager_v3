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
      <div className="h-[31rem] overflow-y-auto overflow-x-hidden scrollbar-thin lg:h-[32rem]">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-elevated/95 backdrop-blur">
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
                <th
                  key={column}
                  className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.14em] text-muted lg:text-[10px]"
                >
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
                  <td className="px-2 py-2.5">
                    <div className="min-w-0">
                      <p
                        className="line-clamp-2 break-words font-display text-[15px] leading-tight lg:text-base"
                        style={{ color: "#f8fbff" }}
                      >
                        {row.company_name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-primary">{row.ticker}</p>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-[13px] font-semibold text-text lg:text-sm">{formatPrice(row.price)}</td>
                  <td className="px-2 py-2.5 text-[13px] text-muted lg:text-sm">{formatPrice(row.min_price)}</td>
                  <td className="px-2 py-2.5 text-[13px] text-muted lg:text-sm">{formatPrice(row.max_price)}</td>
                  <td className="px-2 py-2.5 text-[13px] font-semibold text-text lg:text-sm">{formatPrice(row.predicted_price)}</td>
                  <td
                    className={`px-2 py-2.5 text-[13px] font-semibold lg:text-sm ${
                      Number(row.change_pct) >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatPercent(row.change_pct, 2, true)}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex min-w-[64px] justify-center rounded-chip border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${pillTone(row.signal)}`}>
                      {row.signal}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-[13px] text-text lg:text-sm">{formatPercent(row.confidence_pct, 1)}</td>
                  <td className="px-2 py-2.5 text-[13px] text-text lg:text-sm">{formatPercent(row.discount_pct)}</td>
                  <td className="px-2 py-2.5">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-chip border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${pillTone(row.sentiment)}`}>
                        {row.sentiment}
                      </span>
                      <p className="mt-1 truncate text-[9px] leading-none text-muted">{row.news_count} ET stories</p>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/stock/${row.user_stock_id}`}
                        className="truncate text-[13px] font-semibold text-primary transition hover:translate-x-1 lg:text-sm"
                      >
                        Analysis
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete(row.user_stock_id)}
                        disabled={deletingId === row.user_stock_id}
                        aria-label={`Delete ${row.ticker}`}
                        className="rounded-chip border border-white/10 p-1.5 text-muted transition hover:border-loss/40 hover:text-loss disabled:opacity-60"
                      >
                        <Trash2 size={13} />
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
