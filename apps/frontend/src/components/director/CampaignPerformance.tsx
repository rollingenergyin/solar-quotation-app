'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type RepStat = {
  id: string;
  name: string;
  totalQuotations: number;
  wonQuotations: number;
  conversionRate: number;
  revenue: number;
};

type WeekPoint = { week: string; count: number };

function fmt(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export default function CampaignPerformance({
  repStats,
  weeklyTrend,
}: {
  repStats: RepStat[];
  weeklyTrend: WeekPoint[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Weekly trend chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Weekly Quotation Trend</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              name="Quotations"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sales rep table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales Rep Performance</h2>
        {repStats.length === 0 ? (
          <p className="text-sm text-gray-400">No sales rep data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Rep</th>
                  <th className="text-right pb-2 font-medium">Quotes</th>
                  <th className="text-right pb-2 font-medium">Won</th>
                  <th className="text-right pb-2 font-medium">Conv %</th>
                  <th className="text-right pb-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {repStats
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((rep, i) => (
                    <tr
                      key={rep.id}
                      className={`border-b border-gray-50 ${i === 0 ? 'font-semibold' : ''}`}
                    >
                      <td className="py-2.5 text-gray-800 flex items-center gap-2">
                        {i === 0 && <span className="text-yellow-500 text-xs">🏆</span>}
                        <span className="truncate max-w-[100px]">{rep.name}</span>
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{rep.totalQuotations}</td>
                      <td className="py-2.5 text-right text-green-600">{rep.wonQuotations}</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          rep.conversionRate >= 50 ? 'bg-green-100 text-green-700' :
                          rep.conversionRate >= 25 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {rep.conversionRate}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-700 font-medium">
                        {fmt(rep.revenue)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
