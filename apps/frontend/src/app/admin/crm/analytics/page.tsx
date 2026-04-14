'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '@/lib/api';

type AnalyticsData = {
  today: { leadsCreated: number; messagesSent: number };
  funnel: { stage: string; count: number }[];
  sources: { source: string; count: number }[];
  totalLeads: number;
  avgScore: number;
};

const STAGE_COLORS = ['#6366f1','#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6b7280'];
const SOURCE_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899'];

export default function CrmAnalyticsPage() {
  const { data, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['crm', 'analytics'],
    queryFn: () => api<AnalyticsData>('/crm/analytics'),
    refetchInterval: 30_000,
  });

  const funnel = data?.funnel ?? [];
  const sources = data?.sources ?? [];

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Growth Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time CRM metrics — auto-refreshes every 30s</p>
        </div>
        <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">↻ Refresh</button>
      </div>

      {/* Today KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Leads', value: data?.totalLeads ?? '—', icon: '🎯', color: 'bg-indigo-500' },
          { label: 'Leads Today', value: data?.today.leadsCreated ?? '—', icon: '✨', color: 'bg-green-500' },
          { label: 'Messages Sent Today', value: data?.today.messagesSent ?? '—', icon: '📤', color: 'bg-blue-500' },
          { label: 'Avg Score', value: data ? `${data.avgScore}/100` : '—', icon: '⭐', color: 'bg-yellow-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div className={`w-2 h-2 rounded-full ${card.color} mt-1`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{String(card.value)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Funnel + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Funnel by Stage</h2>
          {isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnel} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="stage" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.replace(/_/g,' ').slice(0, 8)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={40}>
                  {funnel.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Sources</h2>
          {isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} label={({ source, percent }) => `${source} ${Math.round((percent ?? 0) * 100)}%`}>
                  {sources.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Stage table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Stage Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Stage</th>
                <th className="text-right pb-2 font-medium">Leads</th>
                <th className="text-right pb-2 font-medium">% of Total</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((row, i) => {
                const pct = data?.totalLeads ? Math.round((row.count / data.totalLeads) * 100) : 0;
                return (
                  <tr key={row.stage} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-800">{row.stage.replace(/_/g,' ')}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900">{row.count}</td>
                    <td className="py-2.5 text-right text-gray-500">{pct}%</td>
                    <td className="py-2.5 pl-3 w-32">
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
