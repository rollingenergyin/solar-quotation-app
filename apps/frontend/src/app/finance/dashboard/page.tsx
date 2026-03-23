'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import RollingEnergyLogo from '@/components/quotation/RollingEnergyLogo';
import {
  SummaryCard,
  CashflowChart,
  ExpenseIncomeChart,
  FilterBar,
} from '@/components/finance';
import {
  generateCashflowChartData,
  generateExpenseIncomeChartData,
} from '@/lib/finance-chart-data';

interface DashboardData {
  statementSummary: {
    siteExpenses: number;
    commercialExpenses: number;
    siteEarnings: number;
    commercialEarnings: number;
  };
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
  };
  cashflow: {
    openingBalance: number;
    inflows: number;
    outflows: number;
    closingBalance: number;
  };
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const financeQuickActions = [
  { href: '/admin/finance/expenses/new', label: '+ Add Expense', color: 'red' },
  { href: '/admin/finance/incomes/new', label: '+ Add Received', color: 'green' },
  { href: '/admin/finance/bank-upload', label: 'Upload Statement', color: 'blue' },
  { href: '/admin/finance/expenses', label: 'Expenses', color: 'gray' },
  { href: '/admin/finance/incomes', label: 'Incomes', color: 'gray' },
  { href: '/admin/finance/vendors', label: 'Vendors', color: 'gray' },
  { href: '/admin/finance/clients', label: 'Clients', color: 'gray' },
  { href: '/admin/finance/projects', label: 'Projects', color: 'gray' },
  { href: '/admin/finance/invoices', label: 'Invoices', color: 'gray' },
];

const colorClasses: Record<string, string> = {
  gray: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  red: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
};

export default function FinanceDashboardPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (projectId) params.set('projectId', projectId);
    return params.toString();
  }, [period, projectId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api<{ id: string; name: string }[]>('/finance/projects').then(setProjects).catch(() => []);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    api<DashboardData>(`/finance/dashboard?${query}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, query]);

  const cashflowChartData = useMemo(() => {
    if (!data) return [];
    return generateCashflowChartData(period, {
      inflows: data.cashflow.inflows,
      outflows: data.cashflow.outflows,
      openingBalance: data.cashflow.openingBalance,
    });
  }, [data, period]);

  const expenseIncomeChartData = useMemo(() => {
    if (!data) return [];
    return generateExpenseIncomeChartData(period, {
      revenue: data.metrics.totalRevenue,
      expenses: data.metrics.totalExpenses,
    });
  }, [data, period]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-gray-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1600px]">
      <div className="flex items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <RollingEnergyLogo variant="light" size="md" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Finance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Revenue, expenses, and cash flow</p>
          </div>
        </div>
        <FilterBar
          period={period}
          onPeriodChange={setPeriod}
          projectId={projectId}
          onProjectChange={setProjectId}
          projects={projects}
        />
      </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading dashboard…</p>
            </div>
          </div>
        ) : !data ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 mb-2">Failed to load dashboard.</p>
            {error && (
              <span className="block mt-2 text-sm font-mono text-rose-600 max-w-md mx-auto">
                {error}
              </span>
            )}
            <Link href="/finance/dashboard" className="inline-block mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              Retry
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Overview
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  title="Total Revenue"
                  value={fmt(data.metrics.totalRevenue)}
                  variant="revenue"
                />
                <SummaryCard
                  title="Total Expenses"
                  value={fmt(data.metrics.totalExpenses)}
                  variant="expense"
                />
                <SummaryCard
                  title="Profit"
                  value={fmt(data.metrics.grossProfit)}
                  variant="profit"
                  subtitle={
                    data.metrics.totalRevenue > 0
                      ? `${((data.metrics.grossProfit / data.metrics.totalRevenue) * 100).toFixed(1)}% margin`
                      : undefined
                  }
                />
                <SummaryCard
                  title="Closing Balance"
                  value={fmt(data.cashflow.closingBalance)}
                  subtitle="Cash position"
                />
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Cashflow</h3>
                <CashflowChart data={cashflowChartData} />
              </section>
              <section className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Received vs Expense</h3>
                <ExpenseIncomeChart data={expenseIncomeChartData} />
              </section>
            </div>

            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Statement breakdown
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500">Project expenses</p>
                  <p className="text-lg font-semibold text-rose-600 mt-0.5">
                    {fmt(data.statementSummary.siteExpenses)}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500">Commercial expenses</p>
                  <p className="text-lg font-semibold text-rose-600 mt-0.5">
                    {fmt(data.statementSummary.commercialExpenses)}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500">Project earnings</p>
                  <p className="text-lg font-semibold text-emerald-600 mt-0.5">
                    {fmt(data.statementSummary.siteEarnings)}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500">Commercial earnings</p>
                  <p className="text-lg font-semibold text-emerald-600 mt-0.5">
                    {fmt(data.statementSummary.commercialEarnings)}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Quick actions
              </h2>
              <div className="flex flex-wrap gap-2">
                {financeQuickActions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${colorClasses[a.color] ?? colorClasses.gray}`}
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
    </div>
  );
}
