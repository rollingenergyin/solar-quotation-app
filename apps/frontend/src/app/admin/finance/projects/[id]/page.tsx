'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface CostingSummary {
  project: { id: string; name: string; code: string | null; status: string | null };
  expenses: { total: number; count: number; items: { id: string; amount: number; category: string; description: string | null; createdAt: string }[] };
  receivables: { total: number; count: number; items: { id: string; amount: number; category: string | null; description: string | null; createdAt: string }[] };
  purchaseBills: { total: number; count: number; items: { id: string; invoiceNo: string; totalAmount: number; vendor: { name: string }; createdAt: string }[] };
  salesBills: { total: number; count: number; items: { id: string; invoiceNo: string; totalAmount: number; client: { name: string }; createdAt: string }[] };
  stockUsage: { totalCost: number; count: number; items: { id: string; product: { name: string }; quantity: number; unitPrice: number | null; cost: number }[] };
  totals: { totalCost: number; totalRevenue: number; profit: number };
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ProjectCostingPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<CostingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api<CostingSummary>(`/finance/projects/${id}/costing`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !data) return <div className="p-4 md:p-8">Loading…</div>;

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <Link href="/admin/finance/projects" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Projects</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-2">{data.project.name}</h1>
      {data.project.code && <p className="text-sm text-gray-500 mb-6">{data.project.code}</p>}

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold text-rose-600">{fmt(data.totals.totalCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(data.totals.totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Profit</p>
          <p className={`text-2xl font-bold ${data.totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(data.totals.profit)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Expenses */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Expenses ({data.expenses.count})</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {data.expenses.items.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">None</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.expenses.items.map((e) => (
                    <tr key={e.id}><td className="px-4 py-2 text-gray-600">{fmtDate(e.createdAt)}</td><td className="px-4 py-2">{e.category?.replace(/_/g, ' ')}</td><td className="px-4 py-2 text-right text-rose-600">{fmt(e.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Receivables */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Receivables ({data.receivables.count})</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {data.receivables.items.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">None</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.receivables.items.map((i) => (
                    <tr key={i.id}><td className="px-4 py-2 text-gray-600">{fmtDate(i.createdAt)}</td><td className="px-4 py-2">{i.category ?? '—'}</td><td className="px-4 py-2 text-right text-emerald-600">{fmt(i.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Purchase Bills */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Purchase Bills ({data.purchaseBills.count})</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {data.purchaseBills.items.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">None</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Invoice</th>
                    <th className="px-4 py-2 text-left font-medium">Vendor</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.purchaseBills.items.map((b) => (
                    <tr key={b.id}><td className="px-4 py-2">{b.invoiceNo}</td><td className="px-4 py-2">{b.vendor.name}</td><td className="px-4 py-2 text-right">{fmt(b.totalAmount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Sales Bills */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Sales Bills ({data.salesBills.count})</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {data.salesBills.items.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">None</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Invoice</th>
                    <th className="px-4 py-2 text-left font-medium">Client</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.salesBills.items.map((b) => (
                    <tr key={b.id}><td className="px-4 py-2">{b.invoiceNo}</td><td className="px-4 py-2">{b.client.name}</td><td className="px-4 py-2 text-right">{fmt(b.totalAmount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Stock Usage */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Stock Usage ({data.stockUsage.count})</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {data.stockUsage.items.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">None</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.stockUsage.items.map((s) => (
                    <tr key={s.id}><td className="px-4 py-2">{s.product.name}</td><td className="px-4 py-2 text-right">{s.quantity}</td><td className="px-4 py-2 text-right">{fmt(s.cost)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
