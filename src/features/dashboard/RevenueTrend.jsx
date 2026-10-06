import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function RevenueTrend({ data }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Revenue trend</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#rev)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
