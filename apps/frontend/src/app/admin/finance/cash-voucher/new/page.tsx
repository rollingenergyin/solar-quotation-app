'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function CreateCashVoucherPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category: '',
    paymentSource: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('/finance/cash-vouchers', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(form.amount),
          description: form.description || undefined,
          category: form.category || undefined,
          paymentSource: form.paymentSource || undefined,
        }),
      });
      router.push('/finance/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create voucher');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/finance/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Finance</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Create Cash Voucher</h1>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
          <input
            type="number"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Petty cash"
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Source</label>
          <input
            type="text"
            value={form.paymentSource}
            onChange={(e) => setForm((f) => ({ ...f, paymentSource: e.target.value }))}
            placeholder="e.g. Cash"
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Voucher'}
          </button>
          <Link href="/finance/dashboard" className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
