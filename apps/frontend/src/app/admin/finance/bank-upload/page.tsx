'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface BankUpload {
  id: string;
  fileName: string;
  createdAt: string;
  _count: { transactions: number };
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function BankUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ uploadId: string; transactionsCreated: number; totalRows: number } | null>(null);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<BankUpload[]>([]);

  const fetchUploads = () => {
    api<BankUpload[]>('/finance/bank-uploads')
      .then(setUploads)
      .catch(() => []);
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleDeleteUpload = async (uploadId: string) => {
    if (!confirm('Delete this upload and all its transactions? This cannot be undone.')) return;
    try {
      await api(`/finance/bank-uploads/${uploadId}`, { method: 'DELETE' });
      fetchUploads();
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/finance/bank-upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        credentials: 'include',
      } as RequestInit);
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          const err = JSON.parse(text);
          msg = err.error || text;
        } catch {
          /* use raw text */
        }
        throw new Error(msg || 'Upload failed');
      }
      const data = await res.json();
      setResult(data);
      fetchUploads();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg === 'fetch failed' ? 'Backend unreachable. Ensure the API server is running on port 4000.' : msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/finance/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Finance</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Upload Bank Statement</h1>
      <p className="text-sm text-gray-500 mb-4">
        Upload CSV/Excel with columns: Transaction Date, Value Date, Reference No, Description, Withdrawals, Deposits
      </p>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {result && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          Uploaded. {result.transactionsCreated} transactions created from {result.totalRows} rows.{' '}
          <Link href={`/admin/finance/bank-transactions`} className="font-medium underline">
            View & edit transactions
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full"
          />
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      {uploads.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Previous uploads</h2>
          <ul className="space-y-2">
            {uploads.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{u.fileName}</span>
                  <span className="text-sm text-gray-500">{u._count.transactions} transactions</span>
                  <span className="text-sm text-gray-400">{fmtDate(u.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/finance/bank-transactions?uploadId=${u.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleDeleteUpload(u.id)}
                    className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
