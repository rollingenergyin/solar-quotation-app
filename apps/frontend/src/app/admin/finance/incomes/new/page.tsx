'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const PAYMENT_MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'];

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function AddIncomePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    amount: '',
    category: 'Site Earnings',
    clientId: '',
    projectId: '',
    paymentMode: '',
    description: '',
  });

  useEffect(() => {
    api<Client[]>('/finance/clients').then(setClients).catch(() => []);
    api<Project[]>('/finance/projects').then(setProjects).catch(() => []);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('/finance/incomes', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(form.amount),
          category: form.category,
          clientId: form.clientId || undefined,
          projectId: form.projectId || undefined,
          paymentMode: form.paymentMode || undefined,
          description: form.description || undefined,
        }),
      });
      router.push('/finance/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create income');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/finance/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Finance</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Received</h1>

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="Site Earnings">Project Earnings</option>
            <option value="Commercial Earnings">Commercial Earnings</option>
            <option value="Other">Other</option>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <select
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">— Select —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link href="/finance/dashboard" className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
