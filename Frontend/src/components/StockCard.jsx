import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { formatPrice } from "../utils/formatPrice";
import { peColor } from "../utils/peColor";

export default function StockCard({
  stock,
  detail,
  onDelete,
  deleting = false,
}) {
  const data = detail?.stock_data ?? [];
  const latest = data[data.length - 1];
  const latestOpen = Number(latest?.open || 0);
  const latestHigh = Number(latest?.high || 0);
  const latestLow = Number(latest?.low || 0);
  const latestClose = Number(latest?.close || 0);
  const latestVolume = Number(latest?.volume || 0);
  const hasMarketData = data.length > 0 && latestClose > 0 && latestVolume > 0;
  const hasValidCandle = hasMarketData && new Set([latestOpen, latestHigh, latestLow, latestClose]).size > 1;
  const openMovePct = hasMarketData && latestOpen > 0 ? ((latestClose - latestOpen) / latestOpen) * 100 : 0;
  const marketDirection =
    !hasMarketData
      ? "missing"
      : latestClose > latestOpen
        ? "up"
        : latestClose < latestOpen
          ? "down"
          : "flat";
  const directionTone =
    marketDirection === "up"
      ? "border-profit/30 bg-profit/10 text-profit"
      : marketDirection === "down"
        ? "border-loss/30 bg-loss/10 text-loss"
        : marketDirection === "flat"
          ? "border-text/20 bg-white/5 text-text"
          : "border-gold/30 bg-gold/10 text-gold";
  const DirectionIcon =
    marketDirection === "up" ? ArrowUpRight : marketDirection === "down" ? ArrowDownRight : Minus;
  const maxVolume = Math.max(...data.map((item) => Number(item.volume || 0)), 1);
  const volumeRatio = hasMarketData ? Math.min((latestVolume / maxVolume) * 100, 100) : 0;

  const trailingWindow = data.slice(-30);
  const avgVolume =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, item) => sum + Number(item.volume || 0), 0) / trailingWindow.length
      : 0;
  const volumeSpike = hasMarketData && avgVolume > 0 ? latestVolume > avgVolume * 2 : false;
  const peValue = hasMarketData ? Number(latest?.pe_ratio) : Number.NaN;
  const valueScore = Math.max(
    1,
    Math.min(
      10,
      Math.round((peValue && peValue < 15 ? 6 : peValue > 30 ? 3 : 5) + (latestClose > latestOpen ? 2 : 0))
    )
  );

  return (
    <article className="panel hover-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl tracking-wide text-text">{stock.ticker}</p>
          <p className="mt-1 text-xs text-muted">{stock.company_name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-chip border px-2 py-1 text-[11px] uppercase tracking-widest ${
                hasMarketData
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-gold/30 bg-gold/10 text-gold"
              }`}
            >
              {hasMarketData ? "Data synced" : "Needs review"}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-chip border px-2 py-1 text-[11px] uppercase tracking-widest ${directionTone}`}>
              <DirectionIcon size={12} />
              {marketDirection === "up"
                ? `Up ${openMovePct.toFixed(2)}% vs open`
                : marketDirection === "down"
                  ? `Down ${Math.abs(openMovePct).toFixed(2)}% vs open`
                  : marketDirection === "flat"
                    ? "Flat vs open"
                    : "No direction"}
            </span>
            {!hasValidCandle ? (
              <span className="rounded-chip border border-loss/30 bg-loss/10 px-2 py-1 text-[11px] uppercase tracking-widest text-loss">
                Candle issue
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {volumeSpike ? (
            <span className="rounded-chip border border-primary/30 bg-primary/10 px-2 py-1 text-xs uppercase tracking-widest text-primary">
              Volume Spike
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onDelete(stock.id)}
            disabled={deleting}
            aria-label={`Delete ${stock.ticker}`}
            className="rounded-chip border border-white/10 p-2 text-muted transition hover:border-loss/40 hover:text-loss disabled:opacity-60"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {[
          ["Open", hasMarketData ? latestOpen : null, "text-text"],
          ["High", hasMarketData ? latestHigh : null, "text-text"],
          ["Low", hasMarketData ? latestLow : null, "text-text"],
          [
            "Close",
            hasMarketData ? latestClose : null,
            marketDirection === "up"
              ? "text-profit"
              : marketDirection === "down"
                ? "text-loss"
                : "text-text",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className={`rounded-panel bg-white/5 p-2.5 ${label === "Close" ? "ring-1 ring-inset ring-white/5" : ""}`}
          >
            <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
            <p
              className={`mt-2 font-mono text-sm ${
                label === "Close"
                  ? marketDirection === "up"
                    ? "text-profit"
                    : marketDirection === "down"
                      ? "text-loss"
                      : "text-text"
                  : "text-text"
              }`}
            >
              {value != null ? formatPrice(value, 2) : "--"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted">
          <span>Volume</span>
          <span className="font-mono">{hasMarketData ? latestVolume : "--"}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-primary" style={{ width: `${volumeRatio}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-chip border border-white/10 px-2.5 py-1 text-xs font-semibold ${peColor(peValue)} ${
              peValue > 35 ? "animate-pulseGlow" : ""
            }`}
          >
            PE {Number.isFinite(peValue) && peValue > 0 ? peValue.toFixed(2) : "N/A"}
          </span>
          <span className="rounded-chip bg-white/5 px-2.5 py-1 text-xs uppercase tracking-widest text-muted">
            {hasMarketData ? `Value score ${valueScore}/10` : "No market snapshot"}
          </span>
          <span
            className={`rounded-chip border px-2.5 py-1 text-xs font-semibold uppercase tracking-widest ${directionTone}`}
          >
            {marketDirection === "up"
              ? "Bullish"
              : marketDirection === "down"
                ? "Bearish"
                : marketDirection === "flat"
                  ? "Neutral"
                  : "Unknown"}
          </span>
        </div>

        <Link
          to={`/stock/${stock.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:translate-x-1"
        >
          View Chart
        </Link>
      </div>

      {!hasMarketData ? (
        <div className="mt-3 flex items-center gap-2 rounded-panel border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold">
          <AlertTriangle size={14} />
          <span>{data.length === 0 ? "No market data has been synced for this stock yet." : "Market data looks incomplete or unresolved. Please check the symbol."}</span>
        </div>
      ) : null}
    </article>
  );
}
