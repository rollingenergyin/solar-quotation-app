'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { SalesPanelLead } from './salesPanel.types';

type SalesPanelResponse = { leads: SalesPanelLead[] };

type SalesDashboardData = {
  leads: { id: string; name: string; priority: string; quotationCount: number }[];
  suggestions: { type: string; message: string; count: number }[];
};

type SavedQuotation = { id: string; quoteNumber: string; createdAt: string };

type Customer = { id: string };

const features = [
  {
    href: '/sales/quick-quotation',
    icon: '⚡',
    title: 'Quick Quote',
    description: 'Build and send a quotation fast',
    accent: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
    iconBg: 'bg-yellow-100',
  },
  {
    href: '/sales/site-costing',
    icon: '🏗️',
    title: 'Site Costing',
    description: 'Auto installation pricing from site inputs',
    accent: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    iconBg: 'bg-sky-100',
  },
  {
    href: '/sales/quotations',
    icon: '📋',
    title: 'My Quotations',
    description: 'View, edit, and print saved quotes',
    accent: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    iconBg: 'bg-blue-100',
  },
  {
    href: '/sales/customers',
    icon: '👥',
    title: 'Customers',
    description: 'Browse customers, sites, and history',
    accent: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    iconBg: 'bg-indigo-100',
  },
  {
    href: '/sales/customers/new',
    icon: '➕',
    title: 'New Customer',
    description: 'Register a new customer record',
    accent: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    iconBg: 'bg-emerald-100',
  },
  {
    href: '/sales/crm',
    icon: '🎯',
    title: 'CRM',
    description: 'Manage leads, stages, and follow-ups',
    accent: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    iconBg: 'bg-orange-100',
  },
  {
    href: '/attendance',
    icon: '⏱',
    title: 'Attendance',
    description: 'Clock in and track your hours',
    accent: 'bg-purple-50 border-purple-200 hover:border-purple-400',
    iconBg: 'bg-purple-100',
  },
  {
    href: '/sales/profile',
    icon: '👤',
    title: 'Profile',
    description: 'Account details and preferences',
    accent: 'bg-gray-50 border-gray-200 hover:border-gray-400',
    iconBg: 'bg-gray-100',
  },
] as const;

function StatCard({
  label,
  value,
  hint,
  href,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  variant?: 'default' | 'urgent' | 'hot';
}) {
  const variantClass =
    variant === 'urgent'
      ? 'border-red-100 bg-red-50'
      : variant === 'hot'
        ? 'border-orange-100 bg-orange-50'
        : 'border-gray-100 bg-white';

  const inner = (
    <div className={`rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${variantClass}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function SalesDashboardHome() {
  const { user } = useAuth();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const panelQuery = useQuery<SalesPanelResponse>({
    queryKey: ['dashboard', 'sales-panel'],
    queryFn: () => api<SalesPanelResponse>('/dashboard/sales-panel'),
    refetchInterval: 30_000,
  });

  const salesQuery = useQuery<SalesDashboardData>({
    queryKey: ['dashboard', 'sales'],
    queryFn: () => api<SalesDashboardData>('/dashboard/sales'),
    refetchInterval: 60_000,
  });

  const quotationsQuery = useQuery<SavedQuotation[]>({
    queryKey: ['quotations', 'saved'],
    queryFn: () => api<SavedQuotation[]>('/quotations/saved'),
    refetchInterval: 60_000,
  });

  const customersQuery = useQuery<Customer[]>({
    queryKey: ['customers', 'count'],
    queryFn: () => api<Customer[]>('/customers'),
    refetchInterval: 60_000,
  });

  const crmLeads = panelQuery.data?.leads ?? [];
  const urgentCount = crmLeads.filter((l) => l.bucket === 'URGENT').length;
  const hotCount = crmLeads.filter((l) => l.bucket === 'HOT').length;
  const topLeads = crmLeads.slice(0, 5);
  const suggestions = salesQuery.data?.suggestions ?? [];
  const isLoading = panelQuery.isLoading && salesQuery.isLoading;

  function refreshAll() {
    panelQuery.refetch();
    salesQuery.refetch();
    quotationsQuery.refetch();
    customersQuery.refetch();
  }

  return (
    <div className="p-5 md:p-7 max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-gray-400">{today}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Sales Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {greeting}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refreshAll}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:bg-white transition-colors"
          >
            ↻ Refresh
          </button>
          <Link
            href="/sales/quick-quotation"
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            ⚡ Quick Quote
          </Link>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="CRM Leads"
            value={crmLeads.length}
            hint={urgentCount > 0 ? `${urgentCount} need attention` : 'Active pipeline'}
            href="/sales/crm"
            variant={urgentCount > 0 ? 'urgent' : 'default'}
          />
          <StatCard
            label="Customers"
            value={customersQuery.data?.length ?? '—'}
            hint="Total records"
            href="/sales/customers"
          />
          <StatCard
            label="Quotations"
            value={quotationsQuery.data?.length ?? '—'}
            hint="Saved quotes"
            href="/sales/quotations"
          />
          <StatCard
            label="Hot Leads"
            value={hotCount}
            hint={hotCount > 0 ? 'High priority' : 'None right now'}
            href="/sales/crm"
            variant={hotCount > 0 ? 'hot' : 'default'}
          />
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Suggested actions
          </h2>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <Link
                key={s.type}
                href="/sales/customers"
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 hover:border-amber-300 transition-colors"
              >
                <span className="text-sm text-amber-900">{s.message}</span>
                <span className="text-xs font-semibold text-amber-700 flex-shrink-0">View →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Feature grid */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          All features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${f.accent}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${f.iconBg}`}>
                {f.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">
                  {f.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.description}</p>
              </div>
            </Link>
          ))}
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              className="group flex items-start gap-4 p-4 rounded-2xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-all hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-gray-800">
                ⚙️
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Admin Panel</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Users, materials, pricing, and more
                </p>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Priority leads preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Priority leads
          </h2>
          {crmLeads.length > 0 && (
            <Link href="/sales/crm" className="text-xs font-medium text-yellow-600 hover:text-yellow-700">
              Open CRM →
            </Link>
          )}
        </div>
        {panelQuery.isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />
        ) : topLeads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <p className="text-sm font-medium text-gray-700">No CRM leads yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Import or add leads in the CRM to track your pipeline here.
            </p>
            <Link
              href="/sales/crm"
              className="inline-flex text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
            >
              Open CRM
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
            {topLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/sales/crm/${lead.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {lead.city ?? 'No city'} · Score {lead.score}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    lead.bucket === 'URGENT'
                      ? 'bg-red-100 text-red-700'
                      : lead.bucket === 'HOT'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {lead.bucket}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
