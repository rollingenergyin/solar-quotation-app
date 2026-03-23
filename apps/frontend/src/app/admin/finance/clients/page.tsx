'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  gstin: string | null;
  contact: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setError(null);
    api<Client[]>('/finance/clients')
      .then((data) => {
        setClients(data);
      })
      .catch((e) => {
        setClients([]);
        const msg = e instanceof Error ? e.message : 'Failed to load clients';
        setError(msg.includes('unreachable') || msg.includes('refused') || msg.includes('timed out')
          ? 'Cannot reach backend. Ensure the backend is running on port 4000 (npm run dev).'
          : msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    setError(null);
    try {
      await api(`/finance/clients/${confirmDelete.id}`, { method: 'DELETE' });
      setClients((prev) => prev.filter((c) => c.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete client');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <Link href="/finance/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Finance</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Clients</h1>
        <Link href="/admin/finance/clients/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          + Add Client
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No clients yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">GSTIN</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.gstin ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex gap-3">
                        <Link href={`/admin/finance/clients/${c.id}/edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                          disabled={!!deletingId}
                          className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deletingId && setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Delete client?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <strong>{confirmDelete.name}</strong>. Any projects under this client will also be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
