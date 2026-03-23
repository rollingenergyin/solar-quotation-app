'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface CashflowDataPoint {
  month: string;
  inflows: number;
  outflows: number;
  net: number;
  balance: number;
}

interface CashflowChartProps {
  data: CashflowDataPoint[];
  height?: number;
}

const formatCurrency = (n: number) =>
  '₹' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : n).toString();

export default function CashflowChart({ data, height = 260 }: CashflowChartProps) {
  if (!data?.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 bg-gray-50/50"
        style={{ height }}
      >
        No cashflow data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value: number | undefined) => [value != null ? formatCurrency(value) : '', '']}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
        />
        <Area
          type="monotone"
          dataKey="inflows"
          name="Inflows"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#inflowGrad)"
        />
        <Area
          type="monotone"
          dataKey="outflows"
          name="Outflows"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#outflowGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
