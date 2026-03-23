'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function NewVendorPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', gstin: '', contact: '', address: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('/finance/vendors', { method: 'POST', body: JSON.stringify(form) });
      router.push('/admin/finance/vendors');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/admin/finance/vendors" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Vendors</Link>
      <h1 className="text-xl font-bold mb-6">Add Vendor</h1>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">GSTIN</label>
          <input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="22AAAAA0000A1Z5" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact</label>
          <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Vendor'}
        </button>
      </form>
    </div>
  );
}
