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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <Link href="/sales/customers/new"
          className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Customer
        </Link>
      </div>

      <input type="text" placeholder="Search by name…" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-yellow-400" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                    <button
                      type="button"
                      onClick={() => deleteCustomer(c.id, c.name)}
                      disabled={deleting === c.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {deleting === c.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400">
            No customers yet. <Link href="/sales/customers/new" className="text-yellow-600 hover:underline">Add the first one.</Link>
          </div>
        )}
      </div>
    </div>
  );
}
