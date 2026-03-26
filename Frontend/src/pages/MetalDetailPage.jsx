import { useContext, useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { metalsApi } from "../api/metalsApi";
import CorrelationCell from "../components/metals/CorrelationCell";
import MetricCard from "../components/metals/MetricCard";
import MetalsStickyHeader from "../components/metals/MetalsStickyHeader";
import SectionHeader from "../components/metals/SectionHeader";
import StatusBadge from "../components/metals/StatusBadge";
import ToggleChip from "../components/metals/ToggleChip";
import "../components/metals/chartSetup";
import { MetalsContext } from "../context/MetalsContext";
import { useMetals } from "../hooks/useMetals";
import { formatChange, formatPrice, formatTimestamp, getBBPosition, getMACDSignal, getRSILabel } from "../utils/metalsHelpers";

const ranges = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
];

function metalLabel(metal) {
  return metal === "gold" ? "Gold" : "Silver";
}

export default function MetalDetailPage() {
  const { metal: metalParam } = useParams();
  const metal = (metalParam || "").toLowerCase();
  const { setSelectedMetal, triggerSync } = useContext(MetalsContext);
  const [range, setRange] = useState("1m");
  const { prices, ohlc, summary: metalSummary, eda, loading, error } = useMetals(metal, range);
  const [overlays, setOverlays] = useState({
    sma20: true,
    sma50: true,
    ema20: true,
    bollinger: true,
  });
  const [edaOpen, setEdaOpen] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncPage, setSyncPage] = useState(0);
  const [syncLogLoading, setSyncLogLoading] = useState(true);

  useEffect(() => {
    setSelectedMetal(metal);
  }, [metal, setSelectedMetal]);

  useEffect(() => {
    let cancelled = false;

    const loadLogs = async () => {
      try {
        setSyncLogLoading(true);
        const response = await metalsApi.syncLog({ limit: 100, metal: "all" });
        if (!cancelled) {
          setSyncLogs(response.data?.results ?? []);
        }
      } catch (_error) {
        if (!cancelled) {
          setSyncLogs([]);
        }
      } finally {
        if (!cancelled) {
          setSyncLogLoading(false);
        }
      }
    };

    loadLogs();

    return () => {
      cancelled = true;
    };
  }, [metal]);

  const series = useMemo(() => {
    const rows = ohlc.length ? ohlc : prices;
    return {
      labels: rows.map((row) => formatTimestamp(row.timestamp)),
      close: rows.map((row) => (row.close === null || row.close === undefined ? null : Number(row.close))),
      sma20: rows.map((row) => (row.sma_20 === null || row.sma_20 === undefined ? null : Number(row.sma_20))),
      sma50: rows.map((row) => (row.sma_50 === null || row.sma_50 === undefined ? null : Number(row.sma_50))),
      ema20: rows.map((row) => (row.ema_20 === null || row.ema_20 === undefined ? null : Number(row.ema_20))),
      upper: rows.map((row) => (row.bb_upper === null || row.bb_upper === undefined ? null : Number(row.bb_upper))),
      lower: rows.map((row) => (row.bb_lower === null || row.bb_lower === undefined ? null : Number(row.bb_lower))),
      rsi: rows.map((row) => (row.rsi_14 === null || row.rsi_14 === undefined ? null : Number(row.rsi_14))),
      macd: rows.map((row) => (row.macd === null || row.macd === undefined ? null : Number(row.macd))),
      signal: rows.map((row) => (row.signal === null || row.signal === undefined ? null : Number(row.signal))),
    };
  }, [ohlc, prices]);

  const mainChartData = useMemo(
    () => ({
      labels: series.labels,
      datasets: [
        {
          label: "Close",
          data: series.close,
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0, 212, 255, 0.12)",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.35,
        },
        {
          label: "SMA 20",
          data: series.sma20,
          borderColor: "#7dd3fc",
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.25,
          hidden: !overlays.sma20,
        },
        {
          label: "SMA 50",
          data: series.sma50,
          borderColor: "#f59e0b",
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.25,
          hidden: !overlays.sma50,
        },
        {
          label: "EMA 20",
          data: series.ema20,
          borderColor: "#a78bfa",
          borderDash: [2, 2],
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.25,
          hidden: !overlays.ema20,
        },
        {
          label: "Bollinger Upper",
          data: series.upper,
          borderColor: "rgba(56, 189, 248, 0.75)",
          backgroundColor: "rgba(56, 189, 248, 0.12)",
          pointRadius: 0,
          borderWidth: 1,
          tension: 0.25,
          fill: 1,
          hidden: !overlays.bollinger,
        },
        {
          label: "Bollinger Lower",
          data: series.lower,
          borderColor: "rgba(56, 189, 248, 0.12)",
          pointRadius: 0,
          borderWidth: 1,
          tension: 0.25,
          hidden: !overlays.bollinger,
        },
      ],
    }),
    [overlays, series]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#e8f0fe",
          bodyColor: "#e8f0fe",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
        },
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3", maxTicksLimit: 6 } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3" } },
      },
    }),
    []
  );

  const rsiData = useMemo(
    () => ({
      labels: series.labels,
      datasets: [
        {
          label: "RSI 14",
          data: series.rsi,
          borderColor: "#00d4ff",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.35,
        },
        {
          label: "Overbought",
          data: series.rsi.map(() => 70),
          borderColor: "#ff3d57",
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
        {
          label: "Oversold",
          data: series.rsi.map(() => 30),
          borderColor: "#00e676",
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
      ],
    }),
    [series]
  );

  const rsiOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3", maxTicksLimit: 5 } },
        y: { min: 0, max: 100, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3" } },
      },
    }),
    []
  );

  const macdData = useMemo(() => {
    const histogram = series.macd.map((value, index) => {
      const sig = series.signal[index];
      if (value === null || sig === null) {
        return null;
      }
      return Number((value - sig).toFixed(4));
    });

    return {
      labels: series.labels,
      datasets: [
        {
          type: "line",
          label: "MACD",
          data: series.macd,
          borderColor: "#38bdf8",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.3,
        },
        {
          type: "line",
          label: "Signal",
          data: series.signal,
          borderColor: "#f59e0b",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.3,
        },
        {
          type: "bar",
          label: "Histogram",
          data: histogram,
          backgroundColor: histogram.map((value) =>
            value === null ? "rgba(0,0,0,0)" : value >= 0 ? "rgba(0, 230, 118, 0.55)" : "rgba(255, 61, 87, 0.55)"
          ),
          borderWidth: 0,
        },
        {
          type: "line",
          label: "Zero",
          data: histogram.map(() => 0),
          borderColor: "rgba(255,255,255,0.2)",
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
      ],
    };
  }, [series]);

  const macdOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3", maxTicksLimit: 5 } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3" } },
      },
    }),
    []
  );

  const edaReport = eda?.full_report || eda || {};
  const descriptiveStats = edaReport.descriptive_stats || {};
  const correlationMatrix = edaReport.correlation_matrix || {};
  const rollingVolatility = edaReport.rolling_volatility || [];
  const edaSummaryCards = [
    { label: "Total Rows", value: eda?.rows_after ?? "--" },
    { label: "Missing Filled", value: eda?.missing_filled ?? "--" },
    { label: "Outliers Capped", value: eda?.outliers_capped ?? "--" },
    { label: "Stationarity", value: eda?.is_stationary ? "Yes" : "No" },
  ];

  const volatilityData = useMemo(
    () => ({
      labels: rollingVolatility.map((item) => formatTimestamp(item.timestamp)),
      datasets: [
        {
          label: "Rolling Volatility",
          data: rollingVolatility.map((item) => item.value),
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0, 212, 255, 0.12)",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
        },
      ],
    }),
    [rollingVolatility]
  );

  const volatilityOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3", maxTicksLimit: 5 } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3" } },
      },
    }),
    []
  );

  const syncPages = Math.max(1, Math.ceil(syncLogs.length / 10));
  const currentSyncPage = Math.min(syncPage, syncPages - 1);
  const currentSyncEntries = syncLogs.slice(currentSyncPage * 10, currentSyncPage * 10 + 10);
  const currentSummary = metalSummary || {};
  const currentRSI = currentSummary.rsi_14;
  const currentRSILabel = getRSILabel(currentRSI);
  const currentMACDSignal = getMACDSignal(currentSummary.macd, currentSummary.signal);
  const currentBBPosition = getBBPosition(currentSummary.current_price, currentSummary.bb_upper, currentSummary.bb_lower);
  const change1h = formatChange(currentSummary.change_1h_pct);
  const change24h = formatChange(currentSummary.change_24h_pct);
  const change7d = formatChange(currentSummary.change_7d_pct);

  if (!["gold", "silver"].includes(metal)) {
    return (
      <div className="panel space-y-4 p-6">
        <p className="text-xs uppercase tracking-widest text-muted">Metals</p>
        <h1 className="font-display text-3xl text-text">Invalid metal selection</h1>
        <p className="text-sm text-muted">Please choose either gold or silver.</p>
        <Link to="/metals" className="inline-flex rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950">
          Back to Metals
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MetalsStickyHeader activeTab={metal} metal={metal} />

      <section className="grid gap-4 xl:grid-cols-6">
        <MetricCard
          label="Current Price"
          value={formatPrice(currentSummary.current_price, metal)}
          sublabel={currentSummary.last_updated ? formatTimestamp(currentSummary.last_updated) : "No update"}
          tone="neutral"
        />
        <MetricCard
          label="1H %"
          value={change1h.text}
          sublabel={currentSummary.change_1h !== null && currentSummary.change_1h !== undefined ? formatPrice(currentSummary.change_1h, metal) : "--"}
          tone={change1h.className === "text-profit" ? "positive" : change1h.className === "text-loss" ? "negative" : "neutral"}
        />
        <MetricCard
          label="24H %"
          value={change24h.text}
          sublabel={currentSummary.change_24h !== null && currentSummary.change_24h !== undefined ? formatPrice(currentSummary.change_24h, metal) : "--"}
          tone={change24h.className === "text-profit" ? "positive" : change24h.className === "text-loss" ? "negative" : "neutral"}
        />
        <MetricCard
          label="7D %"
          value={change7d.text}
          sublabel={currentSummary.change_7d !== null && currentSummary.change_7d !== undefined ? formatPrice(currentSummary.change_7d, metal) : "--"}
          tone={change7d.className === "text-profit" ? "positive" : change7d.className === "text-loss" ? "negative" : "neutral"}
        />
        <MetricCard
          label="RSI"
          value={currentRSI !== null && currentRSI !== undefined ? Number(currentRSI).toFixed(2) : "--"}
          sublabel={currentRSILabel}
          tone={currentRSILabel === "Overbought" ? "negative" : currentRSILabel === "Oversold" ? "positive" : "neutral"}
        />
        <MetricCard
          label="Ann. Vol %"
          value={currentSummary.annualized_vol !== null && currentSummary.annualized_vol !== undefined ? Number(currentSummary.annualized_vol).toFixed(2) : "--"}
          sublabel={currentBBPosition}
          tone="neutral"
        />
      </section>

      <section className="space-y-4">
        <SectionHeader
          label="Row 2"
          title={`${metalLabel(metal)} OHLC Chart`}
          action={
            <button
              type="button"
              onClick={() => triggerSync()}
              className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          }
        />

        <div className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {ranges.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`rounded-chip px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                  range === item.key ? "bg-primary text-slate-950" : "bg-white/5 text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ToggleChip label="SMA20" checked={overlays.sma20} onChange={(value) => setOverlays((current) => ({ ...current, sma20: value }))} />
            <ToggleChip label="SMA50" checked={overlays.sma50} onChange={(value) => setOverlays((current) => ({ ...current, sma50: value }))} />
            <ToggleChip label="EMA20" checked={overlays.ema20} onChange={(value) => setOverlays((current) => ({ ...current, ema20: value }))} />
            <ToggleChip label="Bollinger" checked={overlays.bollinger} onChange={(value) => setOverlays((current) => ({ ...current, bollinger: value }))} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              Close
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
              SMA20
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              SMA50
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
              EMA20
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-300/70" />
              Bollinger
            </span>
          </div>

          <div className="h-[26rem]">
            {loading ? <div className="skeleton h-full rounded-panel" /> : <Line data={mainChartData} options={chartOptions} />}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="panel p-5">
          <SectionHeader label="Row 3" title="RSI Chart" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">Current RSI</p>
              <h3 className="mt-2 font-display text-2xl text-text">{currentRSI !== null && currentRSI !== undefined ? Number(currentRSI).toFixed(2) : "--"}</h3>
            </div>
            <StatusBadge label={currentRSILabel} tone={currentRSILabel === "Overbought" ? "negative" : currentRSILabel === "Oversold" ? "positive" : "neutral"} />
          </div>
          <div className="mt-4 h-80">
            <Line data={rsiData} options={rsiOptions} />
          </div>
        </article>

        <article className="panel p-5">
          <SectionHeader label="Row 3" title="MACD Chart" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">Signal</p>
              <h3 className="mt-2 font-display text-2xl text-text">{currentMACDSignal}</h3>
            </div>
            <StatusBadge label={currentMACDSignal} tone={currentMACDSignal === "Bullish" ? "positive" : currentMACDSignal === "Bearish" ? "negative" : "neutral"} />
          </div>
          <div className="mt-4 h-80">
            <Bar data={macdData} options={macdOptions} />
          </div>
        </article>
      </section>

      <section className="space-y-4">
        <SectionHeader
          label="Row 4"
          title={`EDA Report - ${eda?.run_timestamp ? formatTimestamp(eda.run_timestamp) : "No report yet"}`}
          action={
            <button
              type="button"
              onClick={() => setEdaOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
            >
              {edaOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {edaOpen ? "Collapse" : "Expand"}
            </button>
          }
        />

        {edaOpen ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {edaSummaryCards.map((card) => (
                <article key={card.label} className="panel p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">{card.label}</p>
                  <p className="mt-3 font-display text-2xl text-text">{String(card.value)}</p>
                </article>
              ))}
            </div>

            <article className="panel overflow-hidden">
              <div className="border-b border-white/5 px-5 py-4">
                <p className="text-xs uppercase tracking-widest text-muted">Stats Table</p>
                <h3 className="mt-2 font-display text-2xl text-text">Open / High / Low / Close / Volume</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs uppercase tracking-widest text-muted">Metric</th>
                      {["Open", "High", "Low", "Close", "Volume"].map((column) => (
                        <th key={column} className="px-4 py-4 text-left text-xs uppercase tracking-widest text-muted">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["mean", "median", "std", "skewness", "kurtosis"].map((rowKey) => (
                      <tr key={rowKey} className="border-t border-white/5">
                        <td className="px-4 py-3 text-sm font-semibold text-text">{rowKey === "std" ? "Std Dev" : rowKey.charAt(0).toUpperCase() + rowKey.slice(1)}</td>
                        {["Open", "High", "Low", "Close", "Volume"].map((column) => (
                          <td key={`${rowKey}-${column}`} className="px-4 py-3 text-sm text-muted">
                            {descriptiveStats[column]?.[rowKey] !== null && descriptiveStats[column]?.[rowKey] !== undefined
                              ? Number(descriptiveStats[column][rowKey]).toFixed(4)
                              : "--"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <div className="grid gap-6 xl:grid-cols-2">
              <article className="panel overflow-hidden">
                <div className="border-b border-white/5 px-5 py-4">
                  <p className="text-xs uppercase tracking-widest text-muted">Correlation Heatmap</p>
                  <h3 className="mt-2 font-display text-2xl text-text">Relationship matrix</h3>
                </div>
                <div className="overflow-x-auto px-4 py-5">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs uppercase tracking-widest text-muted" />
                        {["Open", "High", "Low", "Close", "Volume"].map((column) => (
                          <th key={column} className="px-3 py-2 text-left text-xs uppercase tracking-widest text-muted">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {["Open", "High", "Low", "Close", "Volume"].map((row) => (
                        <tr key={row} className="border-t border-white/5">
                          <td className="px-3 py-2 text-sm font-semibold text-text">{row}</td>
                          {["Open", "High", "Low", "Close", "Volume"].map((column) => (
                            <CorrelationCell key={`${row}-${column}`} value={correlationMatrix[row]?.[column] ?? 0} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel p-5">
                <p className="text-xs uppercase tracking-widest text-muted">Volatility Chart</p>
                <h3 className="mt-2 font-display text-2xl text-text">Rolling 20-period volatility</h3>
                <div className="mt-4 h-[20rem]">
                  <Line data={volatilityData} options={volatilityOptions} />
                </div>
              </article>
            </div>
          </div>
        ) : (
          <p className="rounded-panel border border-border bg-white/5 px-5 py-4 text-sm text-muted">
            Expand the report to review cleaning, stationarity, and correlation details.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader label="Row 5" title="Sync Log" />

        <article className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-white/5">
                <tr>
                  {["Time", "Metal", "Rows Added", "Status", "Message"].map((column) => (
                    <th key={column} className="px-4 py-4 text-left text-xs uppercase tracking-widest text-muted">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncLogLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <div className="skeleton h-12 rounded-panel" />
                    </td>
                  </tr>
                ) : currentSyncEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      No sync log entries yet.
                    </td>
                  </tr>
                ) : (
                  currentSyncEntries.map((entry) => (
                    <tr key={`${entry.id}-${entry.sync_time}`} className="border-t border-white/5">
                      <td className="px-4 py-3 text-sm text-muted">{formatTimestamp(entry.sync_time)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-text">{entry.metal}</td>
                      <td className="px-4 py-3 text-sm text-text">{entry.rows_added}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-chip px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
                            entry.status === "success"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : entry.status === "skipped"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{entry.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {syncPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 py-4">
              <p className="text-sm text-muted">
                Page {currentSyncPage + 1} of {syncPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSyncPage((current) => Math.max(0, current - 1))}
                  disabled={currentSyncPage === 0}
                  className="rounded-panel border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setSyncPage((current) => Math.min(syncPages - 1, current + 1))}
                  disabled={currentSyncPage >= syncPages - 1}
                  className="rounded-panel border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
