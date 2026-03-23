'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  hsn: string | null;
  type: string;
  remainingQty?: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', hsn: '', type: 'SPGS' });

  useEffect(() => {
    api<Product[]>('/finance/products')
      .then(setProducts)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/finance/products', {
        method: 'POST',
        body: JSON.stringify({ name: addForm.name, hsn: addForm.hsn || undefined, type: addForm.type }),
      });
      const list = await api<Product[]>('/finance/products');
      setProducts(list);
      setAddForm({ name: '', hsn: '', type: 'SPGS' });
      setShowAdd(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Products & Stock</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          {showAdd ? 'Cancel' : '+ Add Product'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New Product</h3>
          <div className="flex flex-wrap gap-3">
            <input
              required
              placeholder="Name"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-48"
            />
            <input
              placeholder="HSN"
              value={addForm.hsn}
              onChange={(e) => setAddForm((f) => ({ ...f, hsn: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-24"
            />
            <select
              value={addForm.type}
              onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="SPGS">SPGS</option>
              <option value="EXTERNAL">External</option>
            </select>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {products.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No products yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">HSN</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.hsn ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.type}</td>
                    <td className="px-4 py-3 text-right font-medium">{p.remainingQty ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
