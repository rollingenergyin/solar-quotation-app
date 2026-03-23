'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface ExpenseIncomeDataPoint {
  month: string;
  income: number;
  expense: number;
}

interface ExpenseIncomeChartProps {
  data: ExpenseIncomeDataPoint[];
  height?: number;
}

const formatCurrency = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function ExpenseIncomeChart({
  data,
  height = 280,
}: ExpenseIncomeChartProps) {
  if (!data?.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 bg-gray-50/50"
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
        barGap={8}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => (v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? v / 1e3 + 'K' : v)}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(value: number | undefined) => [value != null ? formatCurrency(value) : '', '']}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
          }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="square"
          iconSize={10}
          formatter={(value) => (
            <span className="text-gray-600 font-medium">{value}</span>
          )}
        />
        <Bar
          dataKey="income"
          name="Received"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
        <Bar
          dataKey="expense"
          name="Expense"
          fill="#f43f5e"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
