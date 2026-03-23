'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Bill {
  id: string;
  invoiceNo: string;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  createdAt: string;
  vendor: { name: string };
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Bill[]>('/finance/purchase-bills')
      .then(setBills)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Purchase Bills</h1>
        <Link href="/admin/finance/purchase-bills/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          + Add Bill
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {bills.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No purchase bills yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Vendor</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{fmtDate(b.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{b.invoiceNo}</td>
                    <td className="px-4 py-3 text-gray-600">{b.vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(b.totalAmount)}</td>
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
