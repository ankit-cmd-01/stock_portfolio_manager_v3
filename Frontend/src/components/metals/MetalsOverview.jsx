import { useContext, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";

import { metalsApi } from "../../api/metalsApi";
import { MetalsContext } from "../../context/MetalsContext";
import { formatChange, formatPrice, formatTimestamp, getRSILabel } from "../../utils/metalsHelpers";
import "./chartSetup";

function StatPill({ label, value, className }) {
  return (
    <div className="rounded-panel border border-border bg-base px-3 py-3">
      <p className="text-[11px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${className}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ title, summary, accent = "text-primary" }) {
  const price = formatPrice(summary?.current_price, title.toLowerCase());
  const change1h = formatChange(summary?.change_1h_pct);
  const change24h = formatChange(summary?.change_24h_pct);
  const change7d = formatChange(summary?.change_7d_pct);
  const annualized =
    summary?.annualized_vol !== null && summary?.annualized_vol !== undefined
      ? Number(summary.annualized_vol).toFixed(2)
      : "--";

  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{title}</p>
          <h3 className={`mt-3 font-display text-3xl ${accent}`}>{price}</h3>
        </div>
        <span className="rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
          {summary?.last_updated ? formatTimestamp(summary.last_updated) : "No data"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatPill label="1H" value={change1h.text} className={change1h.className} />
        <StatPill label="24H" value={change24h.text} className={change24h.className} />
        <StatPill label="7D" value={change7d.text} className={change7d.className} />
        <StatPill
          label="RSI"
          value={
            summary?.rsi_14 === null || summary?.rsi_14 === undefined
              ? "--"
              : `${Number(summary.rsi_14).toFixed(2)} | ${getRSILabel(summary.rsi_14)}`
          }
          className="text-text"
        />
        <StatPill label="Vol%" value={annualized === "--" ? "--" : `${annualized}%`} className="text-text" />
        <StatPill
          label="BB"
          value={
            summary?.current_price && summary?.bb_upper && summary?.bb_lower
              ? ` ${summary.current_price > summary.bb_upper ? "Above" : summary.current_price < summary.bb_lower ? "Below" : "Inside"}`.trim()
              : "--"
          }
          className="text-text"
        />
      </div>
    </article>
  );
}

export default function MetalsOverview() {
  const { goldSummary: gold, silverSummary: silver } = useContext(MetalsContext);
  const [ratioHistory, setRatioHistory] = useState([]);
  const [ratioSummary, setRatioSummary] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [ratioResponse, logResponse] = await Promise.all([
          metalsApi.ratio(30),
          metalsApi.syncLog({ limit: 5, metal: "all" }),
        ]);

        if (cancelled) {
          return;
        }

        setRatioHistory(
          (ratioResponse.data?.timestamps ?? []).map((timestamp, index) => ({
            timestamp,
            value: ratioResponse.data?.ratios?.[index] ?? null,
          }))
        );
        setRatioSummary(ratioResponse.data);
        setSyncLogs(logResponse.data?.results ?? []);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.response?.data?.error || "Unable to load metals overview.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const ratioChartData = useMemo(
    () => ({
      labels: ratioHistory.map((item) => formatTimestamp(item.timestamp)),
      datasets: [
        {
          label: "Gold / Silver Ratio",
          data: ratioHistory.map((item) => item.value),
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0, 212, 255, 0.12)",
          pointRadius: 0,
          tension: 0.35,
          borderWidth: 2,
          fill: true,
        },
      ],
    }),
    [ratioHistory]
  );

  const ratioChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3" } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#6b7fa3" } },
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-2">
        <SummaryCard title="Gold" summary={gold} accent="text-yellow-400" />
        <SummaryCard title="Silver" summary={silver} accent="text-slate-200" />
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Gold / Silver Ratio</p>
            <h3 className="mt-2 font-display text-3xl text-text">
              {ratioSummary?.current_ratio !== null && ratioSummary?.current_ratio !== undefined
                ? Number(ratioSummary.current_ratio).toFixed(2)
                : "--"}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-widest">
            <span className="rounded-chip bg-emerald-500/10 px-3 py-1 text-emerald-300">Below 50 -&gt; Buy Silver</span>
            <span className="rounded-chip bg-amber-500/10 px-3 py-1 text-amber-300">Above 80 -&gt; Buy Gold</span>
          </div>
        </div>

        <div className="mt-5 h-80">
          {loading ? (
            <div className="skeleton h-full rounded-panel" />
          ) : (
            <Line data={ratioChartData} options={ratioChartOptions} />
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4">
          <p className="text-xs uppercase tracking-widest text-muted">Sync Log</p>
          <h3 className="mt-2 font-display text-2xl text-text">Last 5 entries</h3>
        </div>

        {error ? <div className="px-5 py-4 text-sm text-loss">{error}</div> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-white/5">
              <tr>
                {["Time", "Metal", "Rows Added", "Status", "Message"].map((column) => (
                  <th key={column} className="px-5 py-4 text-left text-xs uppercase tracking-widest text-muted">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                    No sync log entries yet.
                  </td>
                </tr>
              ) : (
                syncLogs.map((entry) => (
                  <tr key={`${entry.id}-${entry.sync_time}`} className="border-t border-white/5">
                    <td className="px-5 py-4 text-sm text-muted">{formatTimestamp(entry.sync_time)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-text">{entry.metal}</td>
                    <td className="px-5 py-4 text-sm text-text">{entry.rows_added}</td>
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4 text-sm text-muted">{entry.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
