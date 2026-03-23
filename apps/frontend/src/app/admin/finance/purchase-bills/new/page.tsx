'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Vendor {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function NewPurchaseBillPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    vendorId: '',
    projectId: '',
    gstNumber: '',
    invoiceNo: '',
    baseAmount: '',
    gstAmount: '',
    totalAmount: '',
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
      await api('/finance/purchase-bills', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: form.vendorId,
          projectId: form.projectId || undefined,
          gstNumber: form.gstNumber || undefined,
          invoiceNo: form.invoiceNo,
          baseAmount: Number(form.baseAmount),
          gstAmount: Number(form.gstAmount),
          totalAmount: Number(form.totalAmount),
        }),
      });
      router.push('/admin/finance/purchase-bills');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/admin/finance/purchase-bills" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Purchase Bills</Link>
      <h1 className="text-xl font-bold mb-6">Add Purchase Bill</h1>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Vendor *</label>
          <select
            required
            value={form.vendorId}
            onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">— Select —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Project</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">— Select —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Invoice No *</label>
          <input required value={form.invoiceNo} onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">GST Number</label>
          <input value={form.gstNumber} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Base Amount</label>
            <input type="number" required value={form.baseAmount} onChange={(e) => setForm((f) => ({ ...f, baseAmount: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">GST Amount</label>
            <input type="number" value={form.gstAmount} onChange={(e) => setForm((f) => ({ ...f, gstAmount: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total *</label>
            <input type="number" required value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
