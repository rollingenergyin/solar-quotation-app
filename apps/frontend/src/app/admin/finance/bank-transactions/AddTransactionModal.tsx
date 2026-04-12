'use client';

import { useEffect, useState } from 'react';
import { api, API_URL } from '@/lib/api';
import { ProjectSiteSelect, type FinanceProjectRow, type SiteRow } from './projectSiteSelect';

type BankUpload = { id: string; fileName: string; _count: { transactions: number } };
type Cat = { id: string; name: string };

type SplitRow = { categoryId: string; siteId: string; amount: string; description: string };

async function authHeaders(): Promise<HeadersInit> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function AddTransactionModal({
  open,
  onClose,
  uploads,
  categories,
  sites,
  projects,
  selectedUploadId,
  sortDate,
  disabled,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  uploads: BankUpload[];
  categories: Cat[];
  sites: SiteRow[];
  projects: FinanceProjectRow[];
  selectedUploadId: string;
  sortDate: 'asc' | 'desc';
  disabled?: boolean;
  onCreated: () => void;
}) {
  const [uploadId, setUploadId] = useState(selectedUploadId);
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [txType, setTxType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [useSplit, setUseSplit] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([
    { categoryId: '', siteId: '', amount: '', description: '' },
    { categoryId: '', siteId: '', amount: '', description: '' },
  ]);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUploadId(selectedUploadId);
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setPartyName('');
    setDescription('');
    setTxType('EXPENSE');
    setAmount('');
    const first = categories[0]?.id ?? '';
    setCategoryId(first);
    setSiteId('');
    setUseSplit(false);
    setSplitRows([
      { categoryId: first, siteId: '', amount: '', description: '' },
      { categoryId: first, siteId: '', amount: '', description: '' },
    ]);
    setBillFile(null);
    setError(null);
  }, [open, selectedUploadId, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setError(null);
    const amt = parseFloat(amount);
    if (!uploadId || !transactionDate || !Number.isFinite(amt) || amt <= 0) {
      setError('Please enter upload, date, and a positive amount.');
      return;
    }
    if (useSplit && categories.length === 0) {
      setError('Create at least one category before using split.');
      return;
    }

    let splitsPayload:
      | { categoryId: string; siteId?: string | null; amount: number; description?: string | null }[]
      | undefined;
    if (useSplit) {
      const rows = splitRows.map((r) => ({
        categoryId: r.categoryId,
        siteId: r.siteId || null,
        amount: parseFloat(r.amount),
        description: r.description.trim() || null,
      }));
      if (rows.some((r) => !r.categoryId)) {
        setError('Each split line needs a category.');
        return;
      }
      if (rows.some((r) => !Number.isFinite(r.amount))) {
        setError('Each split line needs a valid amount.');
        return;
      }
      const sum = rows.reduce((s, r) => s + r.amount, 0);
      if (Math.abs(sum - amt) > 0.02) {
        setError(`Split amounts must sum to ${amt.toFixed(2)} (currently ${sum.toFixed(2)}).`);
        return;
      }
      if (rows.length < 2) {
        setError('Add at least two split lines.');
        return;
      }
      splitsPayload = rows;
    }

    setSubmitting(true);
    try {
      const created = await api<{ id: string }>('/finance/bank-transactions', {
        method: 'POST',
        body: JSON.stringify({
          uploadId,
          transactionDate: new Date(transactionDate).toISOString(),
          partyName: partyName.trim() || null,
          description: description.trim() || null,
          amount: amt,
          type: txType,
          categoryId: useSplit ? null : categoryId || null,
          siteId: useSplit ? null : siteId || null,
          listSortDate: sortDate,
          splits: splitsPayload,
        }),
      });
      if (billFile && created?.id) {
        const fd = new FormData();
        fd.append('file', billFile);
        const res = await fetch(`${API_URL}/finance/bank-transactions/${created.id}/bill`, {
          method: 'POST',
          headers: await authHeaders(),
          body: fd,
          credentials: 'include',
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || 'Bill upload failed');
        }
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  };

  const addSplitLine = () => {
    const first = categories[0]?.id ?? '';
    setSplitRows((prev) => [...prev, { categoryId: first, siteId: '', amount: '', description: '' }]);
  };

  const removeSplitLine = (idx: number) => {
    setSplitRows((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-xl w-full shadow-xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Add transaction</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {disabled && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Switch to the main list (leave recycle bin) to add transactions.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload</label>
            <select
              value={uploadId}
              onChange={(e) => setUploadId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
              disabled={disabled || uploads.length === 0}
            >
              {uploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fileName} ({u._count.transactions} txns)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
            <input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Counterparty"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Notes"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Debit / credit</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setTxType('EXPENSE')}
                disabled={disabled}
                className={`px-4 py-2 text-sm font-medium ${
                  txType === 'EXPENSE' ? 'bg-rose-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Debit (expense)
              </button>
              <button
                type="button"
                onClick={() => setTxType('INCOME')}
                disabled={disabled}
                className={`px-4 py-2 text-sm font-medium ${
                  txType === 'INCOME' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Credit (income)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
              disabled={disabled}
              placeholder="0.00"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSplit}
              onChange={(e) => {
                const on = e.target.checked;
                setUseSplit(on);
                if (on) {
                  const a = parseFloat(amount);
                  if (Number.isFinite(a) && a > 0) {
                    const half = Math.round((a / 2) * 100) / 100;
                    const rest = Math.round((a - half) * 100) / 100;
                    const first = categories[0]?.id ?? '';
                    setSplitRows([
                      { categoryId: first, siteId: '', amount: String(half), description: description },
                      { categoryId: first, siteId: '', amount: String(rest), description: '' },
                    ]);
                  }
                }
              }}
              disabled={disabled}
            />
            <span className="text-sm text-gray-700">Split across categories</span>
          </label>

          {!useSplit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  disabled={disabled}
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <div className="w-full [&_select]:w-full [&_select]:max-w-none [&_select]:rounded-lg [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm">
                  <ProjectSiteSelect
                    sites={sites}
                    projects={projects}
                    valueSiteId={siteId || null}
                    onPickSiteId={(sid) => setSiteId(sid ?? '')}
                    disabled={disabled}
                  />
                </div>
              </div>
            </>
          )}

          {useSplit && (
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="text-sm font-medium text-gray-800">Split lines (amounts must sum to total)</div>
              {splitRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border-b border-gray-200 pb-2 last:border-0">
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-gray-600 mb-0.5">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: v } : r)));
                      }}
                      className="w-full border rounded px-2 py-1 text-sm"
                      disabled={disabled}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs text-gray-600 mb-0.5">Category</label>
                    <select
                      value={row.categoryId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, categoryId: v } : r)));
                      }}
                      className="w-full border rounded px-2 py-1 text-sm"
                      disabled={disabled}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs text-gray-600 mb-0.5">Project</label>
                    <div className="w-full [&_select]:w-full [&_select]:max-w-none [&_select]:text-sm">
                      <ProjectSiteSelect
                        sites={sites}
                        projects={projects}
                        valueSiteId={row.siteId || null}
                        onPickSiteId={(sid) => {
                          const v = sid ?? '';
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, siteId: v } : r)));
                        }}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    {splitRows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeSplitLine(idx)}
                        className="text-xs text-red-600 hover:underline"
                        disabled={disabled}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="sm:col-span-12">
                    <input
                      value={row.description}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, description: v } : r)));
                      }}
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="Line description"
                      disabled={disabled}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSplitLine}
                className="text-sm text-blue-600 hover:underline"
                disabled={disabled}
              >
                + Add split line
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill (optional)</label>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">Attached after the transaction is created.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm" disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled || submitting || uploads.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Add transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
