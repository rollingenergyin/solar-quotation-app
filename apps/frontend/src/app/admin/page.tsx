'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import MetricsRow from '@/components/director/MetricsRow';
import FunnelChart from '@/components/director/FunnelChart';
import AlertsPanel from '@/components/director/AlertsPanel';
import CampaignPerformance from '@/components/director/CampaignPerformance';

type DirectorData = {
  kpis: {
    revenueThisMonth: number;
    revenueLastMonth: number;
    quotationsThisMonth: number;
    quotationsLastMonth: number;
    momDelta: number;
    conversionRate: number;
    activeLeads: number;
    totalCustomers: number;
  };
  funnel: { stage: string; count: number }[];
  repStats: {
    id: string;
    name: string;
    totalQuotations: number;
    wonQuotations: number;
    conversionRate: number;
    revenue: number;
  }[];
  weeklyTrend: { week: string; count: number }[];
};

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user: { name: string };
};

export default function DirectorDashboard() {
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery<DirectorData>({
    queryKey: ['dashboard', 'director'],
    queryFn: () => api<DirectorData>('/dashboard/director'),
    refetchInterval: 30_000,
  });

  const { data: auditData } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ['audit', 'recent'],
    queryFn: () => api<{ logs: AuditLog[] }>('/audit?limit=8'),
    refetchInterval: 60_000,
  });

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="p-5 md:p-7 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{today}</p>
          <h1 className="text-xl font-bold text-gray-900">
            Director Dashboard
          </h1>
          {user?.name && (
            <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user.name.split(' ')[0]}</p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-sm text-red-600 mb-6">
          Failed to load dashboard data.{' '}
          <button onClick={() => refetch()} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI Row */}
      {data && <MetricsRow kpis={data.kpis} />}

      {/* Middle section: Funnel + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4" style={{ minHeight: 280 }}>
        <div className="lg:col-span-2">
          {data ? (
            <FunnelChart data={data.funnel} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 h-full animate-pulse" />
          )}
        </div>
        <div>
          <AlertsPanel />
        </div>
      </div>

      {/* Campaign Performance + Trend */}
      {data && (
        <div className="mb-4">
          <CampaignPerformance
            repStats={data.repStats}
            weeklyTrend={data.weeklyTrend}
          />
        </div>
      )}

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
        {!auditData?.logs?.length ? (
          <p className="text-sm text-gray-400">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {auditData.logs.map((log) => (
              <li key={log.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      log.action === 'CREATE'
                        ? 'bg-green-100 text-green-700'
                        : log.action === 'UPDATE'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="text-sm text-gray-700 capitalize">{log.entity}</span>
                  <span className="text-xs text-gray-400">by {log.user?.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
