'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import RollingEnergyLogo from '@/components/quotation/RollingEnergyLogo';

interface Quotation {
  id: string;
  quoteNumber: string;
  version: number;
  customerName: string;
  systemSizeKw: number;
  location: string;
  date: string;
  type: 'QUICK' | 'NORMAL';
  createdBy: string;
  createdByUserId?: string;
  hasStoredPdf: boolean;
}

interface SalesUser {
  id: string;
  userId: string;
  name: string;
}

const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AdminAllQuotationsPage() {
  const [list, setList] = useState<Quotation[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterUser) params.set('createdBy', filterUser);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const data = await api<Quotation[]>(`/quotations/all?${params}`);
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterFrom, filterTo]);

  useEffect(() => {
    api<SalesUser[]>('/users').then(setUsers).catch(() => []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <RollingEnergyLogo variant="light" size="md" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-0.5">All Quotations</h1>
          <p className="text-sm text-gray-500">View quotations from all sales users</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap gap-4 mb-6">
        <div className="w-full md:w-auto">
          <label className="block text-xs text-gray-500 mb-1">Salesperson</label>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full md:w-auto border rounded-lg px-3 py-3 text-base min-h-[44px]"
          >
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={u.userId}>{u.name} ({u.userId})</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-xs text-gray-500 mb-1">From Date</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-full md:w-auto border rounded-lg px-3 py-3 text-base min-h-[44px]"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-xs text-gray-500 mb-1">To Date</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-full md:w-auto border rounded-lg px-3 py-3 text-base min-h-[44px]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-gray-100">
              {list.map((q) => (
                <div key={q.id} className="p-4">
                  <p className="font-medium text-gray-900">{q.quoteNumber}{q.version > 1 ? ` v${q.version}` : ''}</p>
                  <p className="text-sm text-gray-700"><strong>Customer:</strong> {q.customerName}</p>
                  <p className="text-sm text-gray-600"><strong>Size:</strong> {q.systemSizeKw ? `${q.systemSizeKw} kW` : '—'}</p>
                  <p className="text-sm text-gray-600"><strong>By:</strong> {q.createdBy}</p>
                  <p className="text-sm text-gray-600"><strong>Date:</strong> {fmtDate(q.date)}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${
                    q.type === 'QUICK' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {q.type}
                  </span>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/quotation/${q.id}/print`} target="_blank" className="text-sm font-medium text-gray-600 py-2 px-3 rounded-lg bg-gray-100 min-h-[44px] flex items-center">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quote ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">System Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">{q.quoteNumber}{q.version > 1 ? ` v${q.version}` : ''}</td>
                      <td className="px-4 py-3 text-gray-700">{q.customerName}</td>
                      <td className="px-4 py-3 text-gray-700">{q.systemSizeKw ? `${q.systemSizeKw} kW` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{q.createdBy}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(q.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${q.type === 'QUICK' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{q.type}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/quotation/${q.id}/print`} target="_blank" className="text-xs font-medium text-gray-600 hover:text-gray-900">View</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!loading && list.length === 0 && (
          <div className="p-12 text-center text-gray-500">No quotations found.</div>
        )}
      </div>
    </div>
  );
}
