'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Income {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  createdAt: string;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function IncomesPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('monthly');

  useEffect(() => {
    const q = period ? `?period=${period}` : '';
    api<Income[]>(`/finance/incomes${q}`)
      .then(setIncomes)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Received</h1>
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
          <Link href="/admin/finance/incomes/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
            + Add Income
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {incomes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No received yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incomes.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{fmtDate(i.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">{fmt(i.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{i.category ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{i.description ?? '—'}</td>
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
