'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', gstin: '', address: '', city: '', state: '', pincode: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      // Strip empty strings so optional validators (e.g. isEmail) don't reject them
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '')
      );
      const customer = await api<{ id: string }>('/customers', { method: 'POST', body: JSON.stringify(payload) });
      router.push(`/sales/customers/${customer.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/sales/customers" className="text-sm text-gray-400 hover:text-gray-600">Customers</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium">New Customer</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Customer</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Basic Info</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
              <input required value={form.name} onChange={f('name')} placeholder="Subhan Bhakaji Ghenand"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={f('email')} placeholder="name@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <input value={form.phone} onChange={f('phone')} placeholder="9876543210"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Company</label>
              <input value={form.company} onChange={f('company')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">GSTIN</label>
              <input value={form.gstin} onChange={f('gstin')} placeholder="27AAAAA0000A1Z5"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Address</h2>
          <div className="space-y-3">
            <input value={form.address} onChange={f('address')} placeholder="Street address"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            <div className="grid grid-cols-3 gap-3">
              <input value={form.city} onChange={f('city')} placeholder="City"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              <select value={form.state} onChange={f('state')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                <option value="">State</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input value={form.pincode} onChange={f('pincode')} placeholder="Pincode"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <textarea value={form.notes} onChange={f('notes')} rows={2} placeholder="Any additional notes…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/sales/customers" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</Link>
          <button type="submit" disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
