'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const INVOICE_TYPES = ['SPGS', 'PRODUCT', 'SERVICE', 'PROFORMA'] as const;

const SPGS_PRESET = [
  { name: 'Solar Modules', description: 'DCR Certified', hsn: '8541', wattage: true },
  { name: 'Solar Inverter', description: 'Grid-Tied', hsn: '8504', wattage: false },
  { name: 'BOS & Structure', description: 'Mounting, Cables, DB', hsn: '8544', wattage: true },
  { name: 'Installation & Commissioning', description: 'Turnkey', hsn: '9988', wattage: false },
];

interface Client {
  id: string;
  name: string;
}

interface LineItem {
  id: string;
  name: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  amount: number;
  isWattage?: boolean; // use wattage × rate for amount
}

export default function GenerateInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    type: 'SPGS' as (typeof INVOICE_TYPES)[number],
    clientId: '',
    totalWattage: 0,
    ratePerWatt: 0,
    gstRate: 18,
  });
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    api<Client[]>('/finance/clients').then(setClients).catch(() => []);
  }, []);

  useEffect(() => {
    if (form.type === 'SPGS') {
      setItems(
        SPGS_PRESET.map((p, i) => ({
          id: `item-${i}`,
          name: p.name,
          description: p.description,
          hsn: p.hsn,
          qty: p.wattage ? form.totalWattage : 1,
          rate: form.ratePerWatt || 0,
          amount: p.wattage
            ? form.totalWattage * (form.ratePerWatt || 0)
            : 0,
          isWattage: p.wattage,
        }))
      );
    } else if (items.length === 0) {
      setItems([
        {
          id: 'item-0',
          name: 'Item 1',
          description: '',
          hsn: '8541',
          qty: 1,
          rate: 0,
          amount: 0,
        },
      ]);
    }
  }, [form.type, form.totalWattage, form.ratePerWatt]);

  useEffect(() => {
    if (form.type !== 'SPGS') return;
    setItems((prev) =>
      prev.map((p) => {
        const preset = SPGS_PRESET.find((x) => x.name === p.name);
        if (!preset) return p;
        if (preset.wattage) {
          const amount = form.totalWattage * (form.ratePerWatt || 0);
          return { ...p, qty: form.totalWattage, rate: form.ratePerWatt || 0, amount };
        }
        return { ...p, amount: p.rate * (p.qty || 1) };
      })
    );
  }, [form.totalWattage, form.ratePerWatt]);

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const gstAmount = Math.round((subtotal * form.gstRate) / 100);
  const totalAmount = subtotal + gstAmount;

  const updateItem = (id: string, upd: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...upd };
        if (upd.qty !== undefined || upd.rate !== undefined)
          next.amount = (next.qty || 1) * (next.rate || 0);
        return next;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: 'New Item',
        description: '',
        hsn: '8541',
        qty: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        clientId: form.clientId,
        items: items.map((i) => ({
          name: i.name,
          description: i.description || undefined,
          hsn: i.hsn,
          qty: i.qty,
          rate: i.rate,
          amount: i.amount,
        })),
        totalAmount,
      };
      const inv = await api<{ id: string }>('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const pdfRes = await fetch(`/api/finance/invoices/${inv.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      }
      router.push(`/admin/finance/invoices`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/admin/finance/invoices" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Invoices</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Generate Invoice</h1>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as (typeof INVOICE_TYPES)[number] }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {INVOICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="">— Select —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {form.type === 'SPGS' && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">SPGS Billing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Wattage (W)</label>
                <input
                  type="number"
                  min={0}
                  value={form.totalWattage || ''}
                  onChange={(e) => setForm((f) => ({ ...f, totalWattage: Number(e.target.value) || 0 }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">₹ per Watt</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.ratePerWatt || ''}
                  onChange={(e) => setForm((f) => ({ ...f, ratePerWatt: Number(e.target.value) || 0 }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 42.50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Wattage × Rate applied to Modules & BOS. Inverter & Installation use manual rate.
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Line Items</label>
            <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Add Item
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 w-16">HSN</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 w-20">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 w-24">Rate (₹)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 w-24">Amount (₹)</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        className="w-full border-0 bg-transparent py-1 font-medium focus:ring-1 focus:ring-blue-300 rounded"
                        placeholder="Item name"
                      />
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        className="w-full border-0 bg-transparent py-0.5 text-xs text-gray-500 focus:ring-1 focus:ring-blue-300 rounded"
                        placeholder="Description (optional)"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={item.hsn}
                        onChange={(e) => updateItem(item.id, { hsn: e.target.value })}
                        className="w-14 border rounded px-1 py-0.5 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={item.qty || ''}
                        onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.rate || ''}
                        onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{item.amount.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeItem(item.id)} className="text-rose-500 hover:text-rose-600 text-xs">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 max-w-xs ml-auto">
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-600">Subtotal</span>
            <span>₹ {subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-600">GST @ {form.gstRate}%</span>
            <span>₹ {gstAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between font-semibold text-base py-2 border-t mt-2">
            <span>Total</span>
            <span>₹ {totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
            {saving ? 'Creating…' : 'Create & Download PDF'}
          </button>
          <Link href="/admin/finance/invoices" className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
