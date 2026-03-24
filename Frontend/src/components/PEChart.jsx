import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "../utils/formatDate";

export default function PEChart({ data = [] }) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-amber-400/5 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-rose-500/6" />
      <div className="pointer-events-none absolute inset-x-0 top-1/3 h-1/3 bg-amber-400/6" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-emerald-500/6" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Historical PE</p>
          <h3 className="font-display text-2xl text-text">PE Zone Map</h3>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,127,163,0.15)" />
            <XAxis
              dataKey="label"
              stroke="#6B7FA3"
              tick={{ fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              stroke="#6B7FA3"
              tick={{ fontSize: 11 }}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#1A2235",
                border: "1px solid #1E2D45",
                borderRadius: 12,
                color: "#E8F0FE",
              }}
              formatter={(value) => [Number(value).toFixed(2), "PE Ratio"]}
              labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.timestamp)}
            />
            <ReferenceLine y={15} stroke="#00E676" strokeDasharray="4 4" label="PE 15" />
            <ReferenceLine y={30} stroke="#FF3D57" strokeDasharray="4 4" label="PE 30" />
            <Line
              type="monotone"
              dataKey="pe_ratio"
              stroke="#FFB300"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
