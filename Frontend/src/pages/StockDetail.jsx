import { ArrowDown, ArrowUp, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAppToast } from "../App";
import { getUserStock } from "../api/stocks";
import AIInsightPanel from "../components/AIInsightPanel";
import DiscountChart from "../components/DiscountChart";
import OpportunityChart from "../components/OpportunityChart";
import OHLCVChart from "../components/OHLCVChart";
import PEChart from "../components/PEChart";
import SkeletonBlock from "../components/SkeletonBlock";
import { formatPrice } from "../utils/formatPrice";

const rangeOptions = {
  "1H": 12,
  "4H": 48,
  "1D": null,
};

export default function StockDetail() {
  const { pk } = useParams();
  const { onToast } = useAppToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("1D");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await getUserStock(pk);
        setData(response.user_stock);
      } catch (error) {
        onToast({
          type: "error",
          message: error.response?.data?.error || "Unable to load stock detail.",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [onToast, pk]);

  const history = data?.stock_data ?? [];
  const filteredHistory = useMemo(() => {
    const windowSize = rangeOptions[range];
    const slice = windowSize ? history.slice(-windowSize) : history;
    return slice.map((item) => ({
      ...item,
      label: new Date(item.timestamp).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
    }));
  }, [history, range]);

  const latest = filteredHistory[filteredHistory.length - 1];
  const previous = filteredHistory[filteredHistory.length - 2];
  const changePct =
    latest && previous && Number(previous.close) !== 0
      ? ((Number(latest.close) - Number(previous.close)) / Number(previous.close)) * 100
      : 0;

  const peWindow = history.filter((item) => Number(item.pe_ratio) > 0);
  const avgPe =
    peWindow.length > 0
      ? peWindow.reduce((sum, item) => sum + Number(item.pe_ratio), 0) / peWindow.length
      : 0;

  const statCards = [
    {
      label: "All-time High Close",
      value: Math.max(...history.map((item) => Number(item.close || 0)), 0),
    },
    {
      label: "All-time Low Close",
      value: history.length ? Math.min(...history.map((item) => Number(item.close || 0))) : 0,
    },
    {
      label: "Avg Volume",
      value:
        history.length > 0
          ? history.reduce((sum, item) => sum + Number(item.volume || 0), 0) / history.length
          : 0,
      raw: true,
    },
    {
      label: "Current PE vs 1Y Avg",
      value:
        latest && avgPe
          ? `${Number(latest.pe_ratio || 0).toFixed(2)} / ${avgPe.toFixed(2)}`
          : "--",
      raw: true,
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-5">
        <SkeletonBlock className="h-40 w-full" />
        <SkeletonBlock className="h-96 w-full" />
        <SkeletonBlock className="h-80 w-full" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="panel p-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <Link to="/dashboard" className="transition hover:text-text">
            Dashboard
          </Link>
          <ChevronRight size={14} />
          <Link to={`/portfolio/${data.portfolio}`} className="transition hover:text-text">
            {data.portfolio_title}
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-5xl text-text lg:text-6xl">{data.ticker}</h1>
              <span className="rounded-chip bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-muted">
                {data.company_name}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">Tracked inside {data.portfolio_title}</p>
          </div>

          <div>
            <p className="font-mono text-4xl text-text">{formatPrice(latest?.close || 0, 2)}</p>
            <p className={`mt-2 inline-flex items-center gap-1 text-sm ${changePct >= 0 ? "text-profit" : "text-loss"}`}>
              {changePct >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {Math.abs(changePct).toFixed(2)}% from previous candle
            </p>
            <Link
              to={`/advanced/${encodeURIComponent(data.ticker)}`}
              state={{ company: data.company_name, fromPortfolioId: data.portfolio }}
              className="mt-4 inline-flex items-center gap-2 rounded-panel border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:-translate-y-0.5 hover:shadow-cyan"
            >
              <Sparkles size={15} />
              Open Advanced Features
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Chart Section</p>
            <h2 className="font-display text-3xl text-text">OHLCV Storyline</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(rangeOptions).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`rounded-chip px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                  range === option ? "bg-primary text-slate-950" : "border border-border bg-white/5 text-muted"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <OHLCVChart data={filteredHistory} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <OpportunityChart data={filteredHistory} />
        <DiscountChart data={filteredHistory} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PEChart data={filteredHistory.filter((item) => Number(item.pe_ratio) > 0)} />
        <AIInsightPanel />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <article key={item.label} className="panel p-5">
            <p className="text-xs uppercase tracking-widest text-muted">{item.label}</p>
            <p className="mt-4 font-display text-3xl text-text">
              {item.raw ? item.value : formatPrice(item.value || 0, 2)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
