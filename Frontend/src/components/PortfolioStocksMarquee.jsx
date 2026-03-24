import { useMemo } from "react";

import { formatPrice } from "../utils/formatPrice";

export default function PortfolioStocksMarquee({ stocks = [] }) {
  const marqueeItems = useMemo(() => {
    return stocks.map((stock) => ({
      id: stock.id,
      ticker: stock.ticker,
      close: stock.close,
      isUp: Number(stock.changePct ?? 0) >= 0,
    }));
  }, [stocks]);

  const repeatedItems = useMemo(() => [...marqueeItems, ...marqueeItems], [marqueeItems]);
  const durationSeconds = Math.max(24, marqueeItems.length * 4);

  return (
    <div className="mt-5 rounded-panel border border-white/5 bg-white/5 px-3 py-2">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted">
        <span>Stocks</span>
        <span>{marqueeItems.length}</span>
      </div>

      <div className="marquee-frame overflow-hidden">
        {marqueeItems.length > 0 ? (
          <div className="marquee-track flex w-max items-center gap-2 pr-2" style={{ "--marquee-duration": `${durationSeconds}s` }}>
            {repeatedItems.map((stock, index) => (
              <span
                key={`${stock.id}-${index}`}
                className="inline-flex min-w-fit items-center gap-2 rounded-chip border border-primary/20 bg-base px-3 py-1 text-xs text-text"
              >
                <span className={`h-2 w-2 rounded-full ${stock.isUp ? "bg-profit" : "bg-loss"}`} />
                <span className="font-semibold">{stock.ticker}</span>
                <span className="text-muted">{formatPrice(stock.close || 0, 2)}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted">No tracked stocks yet.</span>
        )}
      </div>
    </div>
  );
}
