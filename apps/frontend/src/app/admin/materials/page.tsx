'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Category { id: string; name: string; slug: string }
interface Material {
  id: string; name: string; brand?: string; model?: string;
  unit: string; basePrice?: number; isActive: boolean;
  specs?: Record<string, unknown>;
  category: { id: string; name: string };
}

const UNITS = ['WATT', 'PIECE', 'METER', 'KW', 'SET'];

const emptyForm = { categoryId: '', name: '', brand: '', model: '', unit: 'PIECE', basePrice: '', specs: '' };

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    const [mats, cats] = await Promise.all([
      api<Material[]>(`/materials?search=${search}`),
      api<Category[]>('/materials/categories'),
    ]);
    setMaterials(mats);
    setCategories(cats);
  };

  useEffect(() => { load(); }, [search]);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (m: Material) => {
    setForm({
      categoryId: m.category.id, name: m.name, brand: m.brand ?? '',
      model: m.model ?? '', unit: m.unit,
      basePrice: m.basePrice?.toString() ?? '',
      specs: m.specs ? JSON.stringify(m.specs, null, 2) : '',
    });
    setEditId(m.id); setShowForm(true); setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      let specs: Record<string, unknown> | undefined;
      if (form.specs.trim()) {
        specs = JSON.parse(form.specs);
      }
      const body = {
        categoryId: form.categoryId, name: form.name,
        brand: form.brand || undefined, model: form.model || undefined,
        unit: form.unit,
        basePrice: form.basePrice ? parseFloat(form.basePrice) : undefined,
        specs,
      };
      if (editId) {
        await api(`/materials/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/materials', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowForm(false); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  const deactivate = async (id: string) => {
    if (!confirm('Deactivate this material?')) return;
    await api(`/materials/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Materials & Specs</h1>
        <button onClick={openAdd} className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Add Material
        </button>
      </div>

      <input
        type="text" placeholder="Search materials…" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[44px]"
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{editId ? 'Edit Material' : 'Add Material'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
                <input placeholder="Base price (₹)" type="number" min="0" step="0.01" value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea placeholder='Specs JSON  e.g. {"wattage":540,"efficiency":21.2}' rows={3} value={form.specs}
                onChange={(e) => setForm({ ...form, specs: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name', 'Category', 'Brand/Model', 'Unit', 'Base Price', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {materials.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                <td className="px-4 py-3 text-gray-500">{m.category.name}</td>
                <td className="px-4 py-3 text-gray-500">{[m.brand, m.model].filter(Boolean).join(' / ') || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{m.unit}</td>
                <td className="px-4 py-3 text-gray-700">{m.basePrice ? `₹${m.basePrice.toLocaleString()}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(m)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    {m.isActive && <button onClick={() => deactivate(m.id)} className="text-xs text-red-500 hover:text-red-700">Deactivate</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {materials.length === 0 && <p className="text-center py-12 text-sm text-gray-400">No materials found.</p>}
      </div>
    </div>
  );
}
