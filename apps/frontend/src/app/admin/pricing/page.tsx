'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Material { id: string; name: string; brand?: string; unit: string; basePrice?: number; category: { name: string } }
interface WeeklyPrice { id: string; pricePerUnit: number; effectiveFrom: string; effectiveTo?: string; notes?: string; createdBy: { name: string } }

export default function PricingPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [prices, setPrices] = useState<WeeklyPrice[]>([]);
  const [form, setForm] = useState({ pricePerUnit: '', effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    api<Material[]>('/materials?isActive=true').then(setMaterials).catch(() => {});
  }, []);

  const selectMaterial = async (mat: Material) => {
    setSelected(mat);
    setLoadingPrices(true);
    try {
      const data = await api<WeeklyPrice[]>(`/materials/${mat.id}/prices`);
      setPrices(data);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true); setError('');
    try {
      await api(`/materials/${selected.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({
          pricePerUnit: parseFloat(form.pricePerUnit),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
          notes: form.notes || undefined,
        }),
      });
      setForm({ pricePerUnit: '', effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', notes: '' });
      const data = await api<WeeklyPrice[]>(`/materials/${selected.id}/prices`);
      setPrices(data);
      const updated = await api<Material>(`/materials/${selected.id}`);
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Weekly Pricing</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Material</div>
            <ul className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {materials.map((m) => (
                <li key={m.id}>
                  <button onClick={() => selectMaterial(m)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selected?.id === m.id ? 'bg-yellow-50 border-l-2 border-yellow-500' : 'hover:bg-gray-50'}`}>
                    <div className="text-sm font-medium text-gray-800">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.category.name} · {m.unit}</div>
                    {m.basePrice && <div className="text-xs text-gray-500 mt-0.5">Current: ₹{m.basePrice.toLocaleString()}</div>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          {selected ? (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  New Price Entry — <span className="text-yellow-600">{selected.name}</span>
                </h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Price per {selected.unit} (₹) *</label>
                      <input type="number" min="0" step="0.01" required value={form.pricePerUnit}
                        onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Effective From *</label>
                      <input type="date" required value={form.effectiveFrom}
                        onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Effective To</label>
                      <input type="date" value={form.effectiveTo}
                        onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                      <input placeholder="Optional notes" value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  <button type="submit" disabled={saving}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : 'Add Price Entry'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price History</div>
                {loadingPrices ? (
                  <p className="text-center py-8 text-sm text-gray-400">Loading…</p>
                ) : prices.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-400">No price entries yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Price', 'From', 'To', 'Notes', 'Added By'].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {prices.map((p, i) => (
                        <tr key={p.id} className={i === 0 ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-2.5 font-semibold text-gray-900">₹{p.pricePerUnit.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-gray-600">{new Date(p.effectiveFrom).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.effectiveTo ? new Date(p.effectiveTo).toLocaleDateString() : <span className="text-green-600">Current</span>}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{p.notes || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{p.createdBy?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-400">Select a material to manage pricing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
