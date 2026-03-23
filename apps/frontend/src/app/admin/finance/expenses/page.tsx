'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  createdAt: string;
  vendor?: { name: string } | null;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('monthly');

  useEffect(() => {
    const q = period ? `?period=${period}` : '';
    api<Expense[]>(`/finance/expenses${q}`)
      .then(setExpenses)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
        <div className="flex gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All time</option>
            <option value="daily">Last 24h</option>
            <option value="monthly">This month</option>
            <option value="yearly">This year</option>
          </select>
          <Link href="/admin/finance/expenses/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
            + Add Expense
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No expenses yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Vendor</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-rose-600">{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{e.category?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[280px] truncate" title={e.description ?? undefined}>{e.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
