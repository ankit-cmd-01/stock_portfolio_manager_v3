import { Line, LineChart, ResponsiveContainer } from "recharts";

export default function Sparkline({ data = [], color = "#00D4FF" }) {
  return (
    <div className="h-16 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
