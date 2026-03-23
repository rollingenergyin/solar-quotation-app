'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const CATEGORIES = [
  'SITE_EXPENSE', 'COMMERCIAL_EXPENSE', 'OVERHEADS', 'MARKETING',
  'SALARIES', 'FOOD_ACCOMMODATION', 'MISC',
];
const CATEGORY_LABELS: Record<string, string> = {
  SITE_EXPENSE: 'Project expense',
};
const PAYMENT_MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'];

interface Vendor {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function AddExpensePage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    amount: '',
    category: 'SITE_EXPENSE',
    vendorId: '',
    projectId: '',
    paymentMode: '',
    description: '',
    multiSite: false,
  });

  useEffect(() => {
    api<Vendor[]>('/finance/vendors').then(setVendors).catch(() => []);
    api<Project[]>('/finance/projects').then(setProjects).catch(() => []);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(form.amount),
          category: form.category,
          vendorId: form.vendorId || undefined,
          projectId: form.projectId || undefined,
          paymentMode: form.paymentMode || undefined,
          description: form.description || undefined,
          multiSite: form.multiSite,
        }),
      });
      router.push('/finance/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/finance/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Finance</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Expense</h1>

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">— Select —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
          <select
            value={form.vendorId}
            onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">— Select —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
          <select
            value={form.paymentMode}
            onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">— Select —</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="multiSite"
            checked={form.multiSite}
            onChange={(e) => setForm((f) => ({ ...f, multiSite: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="multiSite" className="text-sm text-gray-700">Multi-project (bulk purchase)</label>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Expense'}
          </button>
          <Link href="/finance/dashboard" className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
