import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "../utils/formatDate";

export default function DiscountChart({ data = [] }) {
  const chartData = data.map((item, index) => {
    const start = Math.max(0, index - 19);
    const window = data.slice(start, index + 1);
    const recentHigh = Math.max(...window.map((entry) => Number(entry.close || 0)), 0);
    const close = Number(item.close || 0);
    const discountPct = recentHigh > 0 && close > 0 ? ((recentHigh - close) / recentHigh) * 100 : 0;

    return {
      ...item,
      discountPct,
      recentHigh,
    };
  });

  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-rose-400/5 to-transparent" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Discount Graph</p>
          <h3 className="font-display text-2xl text-text">Discount from recent high</h3>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="discountGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF3D57" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#FF3D57" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,127,163,0.15)" />
            <XAxis dataKey="label" stroke="#6B7FA3" tick={{ fontSize: 11 }} tickMargin={8} minTickGap={24} />
            <YAxis
              stroke="#6B7FA3"
              tick={{ fontSize: 11 }}
              width={54}
              tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#1A2235",
                border: "1px solid #1E2D45",
                borderRadius: 12,
                color: "#E8F0FE",
              }}
              labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.timestamp)}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, "Discount"]}
            />
            <Area
              type="monotone"
              dataKey="discountPct"
              stroke="#FF3D57"
              strokeWidth={2.5}
              fill="url(#discountGradient)"
              dot={false}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
