'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface SavedQuotation {
  id: string;
  quoteNumber: string;
  version: number;
  customerName: string;
  systemSizeKw: number;
  location: string;
  date: string;
  type: 'QUICK' | 'NORMAL';
  createdBy: string;
  hasStoredPdf: boolean;
}

const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function SavedQuotationsPage() {
  const [list, setList] = useState<SavedQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<SavedQuotation[]>('/quotations/saved');
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteQuotation = async (id: string, quoteNumber: string) => {
    if (!confirm(`Delete quotation ${quoteNumber}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api(`/quotations/${id}`, { method: 'DELETE' });
      setList((prev) => prev.filter((q) => q.id !== id));
    } catch {
      alert('Failed to delete quotation');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 text-center text-gray-500 text-sm">Loading saved quotations…</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-4 mb-6">
        <Link href="/sales" className="text-sm text-gray-400 hover:text-gray-600">← Sales Dashboard</Link>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">My Quotations</h1>
        <p className="text-sm text-gray-500">
          View or edit your quotations
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 md:p-12 text-center text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No saved quotations yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Create a quotation from Quick Quote or Normal workflow to see it here.
            </p>
            <Link href="/sales/quick-quotation" className="inline-block mt-4 text-yellow-600 hover:text-yellow-700 font-medium text-sm py-2">
              → Create Quick Quotation
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-gray-100">
              {list.map((q) => (
                <div key={q.id} className="p-4 border-b border-gray-100 last:border-0">
                  <p className="font-medium text-gray-900">{q.quoteNumber}{q.version > 1 ? ` v${q.version}` : ''}</p>
                  <p className="text-sm text-gray-700 mt-0.5"><strong>Customer:</strong> {q.customerName}</p>
                  <p className="text-sm text-gray-600"><strong>Size:</strong> {q.systemSizeKw ? `${q.systemSizeKw} kW` : '—'}</p>
                  <p className="text-sm text-gray-600 truncate"><strong>Location:</strong> {q.location || '—'}</p>
                  <p className="text-sm text-gray-600"><strong>Date:</strong> {fmtDate(q.date)}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${
                    q.type === 'QUICK' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {q.type}
                  </span>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link href={`/quotation/${q.id}/print`} target="_blank" className="text-sm font-medium text-gray-600 hover:text-gray-900 py-2 px-3 rounded-lg bg-gray-100">
                      View
                    </Link>
                    <Link href={`/sales/quotations/${q.id}/edit`} className="text-sm font-medium text-blue-600 hover:text-blue-700 py-2 px-3 rounded-lg bg-blue-50">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteQuotation(q.id, q.quoteNumber)}
                      disabled={deleting === q.id}
                      className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50 py-2 px-3 rounded-lg bg-red-50 min-h-[44px]"
                    >
                      {deleting === q.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quotation ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">System Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {list.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {q.quoteNumber}{q.version > 1 ? ` v${q.version}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{q.customerName}</td>
                      <td className="px-4 py-3 text-gray-700">{q.systemSizeKw ? `${q.systemSizeKw} kW` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={q.location}>
                        {q.location}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(q.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          q.type === 'QUICK' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {q.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/quotation/${q.id}/print`} target="_blank" className="text-xs font-medium text-gray-600 hover:text-gray-900">View</Link>
                          <Link href={`/sales/quotations/${q.id}/edit`} className="text-xs font-medium text-blue-600 hover:text-blue-700">Edit</Link>
                          <button type="button" onClick={() => deleteQuotation(q.id, q.quoteNumber)} disabled={deleting === q.id} className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50">
                            {deleting === q.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
