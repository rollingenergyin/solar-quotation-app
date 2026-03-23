'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

function downloadPdf(id: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  fetch(`/api/finance/invoices/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id.slice(-8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => {});
}

interface Invoice {
  id: string;
  type: string;
  totalAmount: number;
  createdAt: string;
  client: { name: string };
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    const q = typeFilter ? `?type=${typeFilter}` : '';
    api<Invoice[]>(`/finance/invoices${q}`)
      .then(setInvoices)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        <div className="flex gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="SPGS">SPGS</option>
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
            <option value="PROFORMA">Proforma</option>
          </select>
          <Link href="/admin/finance/invoices/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
            + New Invoice
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No invoices yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{fmtDate(i.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{i.type}</td>
                    <td className="px-4 py-3 text-gray-600">{i.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(i.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => downloadPdf(i.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        PDF
                      </button>
                    </td>
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
