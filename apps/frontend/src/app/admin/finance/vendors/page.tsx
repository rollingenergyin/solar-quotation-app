'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Vendor {
  id: string;
  name: string;
  gstin: string | null;
  contact: string | null;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Vendor[]>('/finance/vendors')
      .then(setVendors)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <Link href="/finance/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Finance</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
        <Link href="/admin/finance/vendors/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          + Add Vendor
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {vendors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No vendors yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">GSTIN</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-gray-600">{v.gstin ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{v.contact ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/finance/vendors/${v.id}/edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Edit
                      </Link>
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
