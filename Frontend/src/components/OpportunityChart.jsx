import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";

import { formatDate } from "../utils/formatDate";
import { formatPrice } from "../utils/formatPrice";

export default function OpportunityChart({ data = [] }) {
  const [mode, setMode] = useState("buy");
  const movingAverageWindow = 20;

  const chartData = useMemo(
    () =>
      data.map((item, index) => {
        const start = Math.max(0, index - movingAverageWindow + 1);
        const window = data.slice(start, index + 1);
        const movingAverage =
          window.length > 0
            ? window.reduce((sum, entry) => sum + Number(entry.close || 0), 0) / window.length
            : 0;
        const close = Number(item.close || 0);
        const spreadPct = movingAverage > 0 ? ((close - movingAverage) / movingAverage) * 100 : 0;

        return {
          ...item,
          movingAverage,
          buyOpportunityPct: spreadPct < 0 ? Math.abs(spreadPct) : 0,
          sellOpportunityPct: spreadPct > 0 ? spreadPct : 0,
          spreadPct,
        };
      }),
    [data]
  );

  const opportunityKey = mode === "buy" ? "buyOpportunityPct" : "sellOpportunityPct";
  const opportunityColor = mode === "buy" ? "#00E676" : "#FF3D57";
  const opportunityFill = mode === "buy" ? "url(#buyOpportunityGradient)" : "url(#sellOpportunityGradient)";
  const latestOpportunity = chartData[chartData.length - 1]?.[opportunityKey] ?? 0;
  const latestSpread = chartData[chartData.length - 1]?.spreadPct ?? 0;
  const chartLabel = mode === "buy" ? "Buy Opportunity" : "Sell Opportunity";
  const chartTitle = mode === "buy" ? "Buy setup vs moving average" : "Sell setup vs moving average";

  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-emerald-400/5 to-transparent" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Opportunity Graph</p>
          <h3 className="font-display text-2xl text-text">{chartTitle}</h3>
          <p className="mt-1 text-sm text-muted">
            20-period moving average comparison, with {mode === "buy" ? "discount" : "premium"} shown as a percentage.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-panel border border-border bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("buy")}
            className={`rounded-chip px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
              mode === "buy" ? "bg-primary text-slate-950" : "text-muted"
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setMode("sell")}
            className={`rounded-chip px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
              mode === "sell" ? "bg-primary text-slate-950" : "text-muted"
            }`}
          >
            Sell
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-chip border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-text">
          {chartLabel}
        </span>
        <span className={`rounded-chip border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${
          mode === "buy"
            ? "border-profit/30 bg-profit/10 text-profit"
            : "border-loss/30 bg-loss/10 text-loss"
        }`}>
          {Math.abs(latestOpportunity).toFixed(2)}% opportunity
        </span>
        <span className="text-xs uppercase tracking-widest text-muted">
          Spread vs MA: {latestSpread >= 0 ? "+" : "-"}
          {Math.abs(latestSpread).toFixed(2)}%
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="buyOpportunityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00E676" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#00E676" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="sellOpportunityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF3D57" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#FF3D57" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,127,163,0.15)" />
            <XAxis dataKey="label" stroke="#6B7FA3" tick={{ fontSize: 11 }} tickMargin={8} minTickGap={24} />
            <YAxis
              yAxisId="price"
              stroke="#6B7FA3"
              tick={{ fontSize: 11 }}
              width={68}
              tickFormatter={(value) => formatPrice(value, 0)}
            />
            <YAxis
              yAxisId="opportunity"
              orientation="right"
              stroke="#6B7FA3"
              tick={{ fontSize: 11 }}
              width={54}
              tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
            />
            <ReferenceLine yAxisId="opportunity" y={0} stroke="rgba(107,127,163,0.2)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                background: "#1A2235",
                border: "1px solid #1E2D45",
                borderRadius: 12,
                color: "#E8F0FE",
              }}
              labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.timestamp)}
              formatter={(value, name) => {
                if (name === "Close" || name === "Moving Average") {
                  return [formatPrice(value, 2), name];
                }
                return [`${Number(value).toFixed(2)}%`, chartLabel];
              }}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="close"
              name="Close"
              stroke="#E8F0FE"
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="movingAverage"
              name="Moving Average"
              stroke={opportunityColor}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive
            />
            <Area
              yAxisId="opportunity"
              type="monotone"
              dataKey={opportunityKey}
              stroke={opportunityColor}
              strokeWidth={2.5}
              fill={opportunityFill}
              dot={false}
              isAnimationActive
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
