import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "../utils/formatDate";
import { formatPrice } from "../utils/formatPrice";

export default function OHLCVChart({ data = [] }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">OHLCV View</p>
          <h3 className="font-display text-2xl text-text">Price + Volume</h3>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,127,163,0.15)" />
            <XAxis dataKey="label" stroke="#6B7FA3" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis
              yAxisId="price"
              stroke="#6B7FA3"
              tick={{ fontSize: 11 }}
              width={68}
              tickFormatter={(value) => `Rs ${Math.round(value)}`}
            />
            <YAxis yAxisId="volume" orientation="right" hide />
            <Tooltip
              contentStyle={{
                background: "#1A2235",
                border: "1px solid #1E2D45",
                borderRadius: 12,
                color: "#E8F0FE",
              }}
              labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.timestamp)}
              formatter={(value, name) => {
                if (name === "Volume") {
                  return [value, name];
                }
                return [formatPrice(value, 2), name];
              }}
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="rgba(0, 212, 255, 0.18)"
              radius={[4, 4, 0, 0]}
              barSize={8}
              isAnimationActive
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="close"
              name="Close"
              stroke="#00D4FF"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
