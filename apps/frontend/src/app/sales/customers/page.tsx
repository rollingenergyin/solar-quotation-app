'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Customer {
  id: string; name: string; email?: string; phone?: string;
  city?: string; company?: string; createdAt: string;
  _count: { sites: number; quotations: number };
  createdBy: { name: string };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadCustomers = () => {
    api<Customer[]>(`/customers?search=${encodeURIComponent(search)}`).then(setCustomers).catch(() => {});
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const deleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete customer');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customers</h1>
        <Link href="/sales/customers/new"
          className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors text-center min-h-[44px] flex items-center justify-center">
          + New Customer
        </Link>
      </div>

      <input type="text" placeholder="Search by name…" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[44px]" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile cards */}
        <div className="block md:hidden divide-y divide-gray-100">
          {customers.map((c) => (
            <div key={c.id} className="p-4">
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-sm text-gray-600"><strong>Company:</strong> {c.company || '—'}</p>
              <p className="text-sm text-gray-600"><strong>Phone:</strong> {c.phone || '—'}</p>
              <p className="text-sm text-gray-600"><strong>City:</strong> {c.city || '—'}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c._count.sites} sites</span>
                <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">{c._count.quotations} quotes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Added by {c.createdBy?.name}</p>
              <div className="flex gap-2 mt-3">
                <Link href={`/sales/customers/${c.id}`} className="text-sm font-medium text-blue-600 py-2 px-3 rounded-lg bg-blue-50 min-h-[44px] flex items-center">Open →</Link>
                <button
                  type="button"
                  onClick={() => deleteCustomer(c.id, c.name)}
                  disabled={deleting === c.id}
                  className="text-sm font-medium text-red-500 py-2 px-3 rounded-lg bg-red-50 min-h-[44px] disabled:opacity-50"
                >
                  {deleting === c.id ? '…' : 'Delete'}
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
                {['Name', 'Company', 'Phone', 'City', 'Sites', 'Quotations', 'Added By', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.company || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c._count.sites}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">{c._count.quotations}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.createdBy?.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/sales/customers/${c.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Open →</Link>
                      <button type="button" onClick={() => deleteCustomer(c.id, c.name)} disabled={deleting === c.id} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                        {deleting === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400 p-4">
            No customers yet. <Link href="/sales/customers/new" className="text-yellow-600 hover:underline">Add the first one.</Link>
          </div>
        )}
      </div>
    </div>
  );
}
