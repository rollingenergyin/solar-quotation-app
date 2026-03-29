'use client';

import { Fragment, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import BillAttachmentCell from './BillAttachmentCell';
import type { LinkedFinanceBill } from './BillAttachmentCell';

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export interface TxSplit {
  id: string;
  amount: number;
  description: string | null;
  categoryId: string;
  siteId: string | null;
  category?: { id: string; name: string };
  site?: { id: string; name: string } | null;
  purchaseBill?: LinkedFinanceBill | null;
  salesBill?: LinkedFinanceBill | null;
}

export interface BankTx {
  id: string;
  transactionDate: string;
  amount: number;
  type: string;
  isSplit?: boolean;
  category?: { id: string; name: string } | null;
  description: string | null;
  partyName: string | null;
  referenceNo: string | null;
  manualOverride: boolean;
  site?: { id: string; name: string } | null;
  splits?: TxSplit[];
  purchaseBill?: LinkedFinanceBill | null;
  salesBill?: LinkedFinanceBill | null;
}

interface Props {
  uploadId: string;
  transactions: BankTx[];
  setTransactions: React.Dispatch<React.SetStateAction<BankTx[]>>;
  categories: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  onTotalsRefresh: () => void;
  onTransactionsRefresh: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  /** Recycle-bin view: row reordering disabled */
  disableDrag?: boolean;
}

function evenSplitAmounts(total: number, n: number): number[] {
  if (n < 1) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  const arr = Array(n).fill(base);
  for (let i = 0; i < rem; i++) arr[i] += 1;
  return arr.map((x) => x / 100);
}

function sumSplitsOk(parentAmount: number, splits: { amount: number }[]): boolean {
  const s = splits.reduce((a, x) => a + x.amount, 0);
  return Math.abs(s - parentAmount) < 0.02;
}

export default function BankTransactionsTable({
  uploadId,
  transactions,
  setTransactions,
  categories,
  sites,
  onTotalsRefresh,
  onTransactionsRefresh,
  selectedIds,
  onToggleSelect,
  disableDrag = false,
}: Props) {
  const [inline, setInline] = useState<{ id: string; field: 'partyName' | 'description' } | null>(null);
  const [draft, setDraft] = useState('');
  const [splitErr, setSplitErr] = useState<Record<string, string>>({});
  const partyRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = inline?.field === 'partyName' ? partyRef.current : descRef.current;
    if (inline && el) {
      el.focus();
      el.select();
    }
  }, [inline]);

  const patchTx = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const updated = await api<BankTx>(`/finance/bank-transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...body, manualOverride: true }),
      });
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      onTotalsRefresh();
    },
    [setTransactions, onTotalsRefresh]
  );

  const startInline = (t: BankTx, field: 'partyName' | 'description') => {
    setInline({ id: t.id, field });
    setDraft(field === 'partyName' ? (t.partyName ?? '') : (t.description ?? ''));
  };

  const commitInline = async () => {
    if (!inline) return;
    const { id, field } = inline;
    const key = field === 'partyName' ? 'partyName' : 'description';
    await patchTx(id, { [key]: draft.trim() || null });
    setInline(null);
    setDraft('');
  };

  const cancelInline = () => {
    setInline(null);
    setDraft('');
  };

  const moveRow = async (rowIndex: number, direction: -1 | 1) => {
    if (disableDrag) return;
    const j = rowIndex + direction;
    if (j < 0 || j >= transactions.length) return;
    const prevSnap = transactions;
    const next = arrayMove(transactions, rowIndex, j);
    setTransactions(next);
    try {
      await api('/finance/bank-transactions/reorder', {
        method: 'POST',
        body: JSON.stringify({ uploadId, orderedIds: next.map((t) => t.id) }),
      });
    } catch {
      setTransactions(prevSnap);
    }
  };

  const handleCategoryChange = async (t: BankTx, categoryId: string | null) => {
    if (t.isSplit) return;
    await patchTx(t.id, { categoryId: categoryId || null });
  };

  const handleSiteChange = async (t: BankTx, siteId: string | null) => {
    if (t.isSplit) return;
    await patchTx(t.id, { siteId: siteId || null });
  };

  const defaultCategoryId = categories[0]?.id ?? '';

  const saveSplitsRaw = async (
    t: BankTx,
    splits: { categoryId: string; siteId?: string | null | undefined; amount: number; description?: string | null }[]
  ) => {
    if (!sumSplitsOk(t.amount, splits)) {
      setSplitErr((s) => ({ ...s, [t.id]: `Splits must sum to ${fmt(t.amount)}` }));
      return;
    }
    setSplitErr((s) => ({ ...s, [t.id]: '' }));
    try {
      const created = await api<TxSplit[]>(`/finance/bank-transactions/${t.id}/splits`, {
        method: 'POST',
        body: JSON.stringify({
          splits: splits.map((sp) => ({
            categoryId: sp.categoryId,
            siteId: sp.siteId ?? undefined,
            amount: sp.amount,
            description: sp.description ?? undefined,
          })),
        }),
      });
      setTransactions((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? {
                ...x,
                isSplit: true,
                category: null,
                site: null,
                splits: created.map((sp) => ({
                  ...sp,
                  category: categories.find((c) => c.id === sp.categoryId) ?? { id: sp.categoryId, name: '' },
                  site: sp.siteId ? sites.find((si) => si.id === sp.siteId) ?? null : null,
                })),
              }
            : x
        )
      );
      onTotalsRefresh();
    } catch (err) {
      setSplitErr((s) => ({
        ...s,
        [t.id]: err instanceof Error ? err.message : 'Save failed',
      }));
    }
  };

  const createSplit = async (t: BankTx) => {
    if (!defaultCategoryId) {
      setSplitErr((s) => ({ ...s, [t.id]: 'Create a category first.' }));
      return;
    }
    const half = Math.round((t.amount / 2) * 100) / 100;
    const rest = Math.round((t.amount - half) * 100) / 100;
    await saveSplitsRaw(t, [
      { categoryId: defaultCategoryId, amount: half, description: t.description ?? '' },
      { categoryId: defaultCategoryId, amount: rest, description: '' },
    ]);
  };

  const addSplitRow = async (t: BankTx) => {
    const cur = t.splits ?? [];
    if (!defaultCategoryId || cur.length < 1) return;
    const n = cur.length + 1;
    const amounts = evenSplitAmounts(t.amount, n);
    const payload = cur.map((s, i) => ({
      categoryId: s.categoryId,
      siteId: s.siteId ?? undefined,
      amount: amounts[i] ?? s.amount,
      description: s.description ?? undefined,
    }));
    payload.push({
      categoryId: defaultCategoryId,
      siteId: undefined,
      amount: amounts[n - 1] ?? 0,
      description: undefined,
    });
    await saveSplitsRaw(t, payload);
  };

  const autoDistribute = (t: BankTx) => {
    const cur = t.splits ?? [];
    if (cur.length < 1) return;
    const amounts = evenSplitAmounts(t.amount, cur.length);
    const payload = cur.map((s, i) => ({
      categoryId: s.categoryId,
      siteId: s.siteId ?? undefined,
      amount: amounts[i] ?? 0,
      description: s.description ?? undefined,
    }));
    saveSplitsRaw(t, payload);
  };

  const clearSplits = async (t: BankTx) => {
    try {
      await api(`/finance/bank-transactions/${t.id}/splits`, { method: 'DELETE' });
      setTransactions((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, isSplit: false, splits: undefined } : x))
      );
      onTotalsRefresh();
    } catch {
      // ignore
    }
  };

  const patchSplit = async (t: BankTx, sp: TxSplit, body: Partial<TxSplit>) => {
    try {
      const updated = await api<TxSplit>(`/finance/bank-transactions/${t.id}/splits/${sp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.siteId !== undefined ? { siteId: body.siteId } : {}),
        }),
      });
      setTransactions((prev) =>
        prev.map((x) => {
          if (x.id !== t.id || !x.splits) return x;
          return {
            ...x,
            splits: x.splits.map((s) =>
              s.id === sp.id
                ? {
                    ...updated,
                    category: categories.find((c) => c.id === updated.categoryId) ?? s.category,
                    site: updated.siteId ? sites.find((si) => si.id === updated.siteId) ?? null : null,
                  }
                : s
            ),
          };
        })
      );
      setSplitErr((s) => ({ ...s, [t.id]: '' }));
      onTotalsRefresh();
    } catch (err) {
      setSplitErr((s) => ({
        ...s,
        [t.id]: err instanceof Error ? err.message : 'Update failed',
      }));
    }
  };

  const deleteSplit = async (t: BankTx, sp: TxSplit) => {
    try {
      await api(`/finance/bank-transactions/${t.id}/splits/${sp.id}`, { method: 'DELETE' });
      const remaining = (t.splits ?? []).filter((s) => s.id !== sp.id);
      if (remaining.length === 0) {
        await clearSplits(t);
        return;
      }
      setTransactions((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, splits: remaining } : x))
      );
      onTotalsRefresh();
    } catch (err) {
      setSplitErr((s) => ({
        ...s,
        [t.id]: err instanceof Error ? err.message : 'Delete failed',
      }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-0.5 py-2 w-9 text-center text-xs font-semibold text-gray-600" title="Move row">
              Order
            </th>
            <th className="px-2 py-3 w-10">
              <span className="sr-only">Select</span>
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Party</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 max-w-[140px]">Description</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">Debit</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">Credit</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Category</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Project</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 w-[100px]">Bill</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 min-w-[120px]">Split</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((t, rowIndex) => (
              <Fragment key={t.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-0.5 py-2 align-middle">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        className="leading-none px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move up"
                        disabled={disableDrag || rowIndex === 0}
                        onClick={() => moveRow(rowIndex, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="leading-none px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move down"
                        disabled={disableDrag || rowIndex === transactions.length - 1}
                        onClick={() => moveRow(rowIndex, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => onToggleSelect(t.id)}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{fmtDate(t.transactionDate)}</td>
                        <td className="px-3 py-3 text-gray-700 align-top">
                          <div className="flex items-start gap-1">
                            {inline?.id === t.id && inline.field === 'partyName' ? (
                              <input
                                ref={partyRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => commitInline()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitInline();
                                  if (e.key === 'Escape') cancelInline();
                                }}
                                className="w-full min-w-[120px] border rounded px-2 py-1 text-sm"
                              />
                            ) : (
                              <span className="flex-1">{t.partyName ?? '—'}</span>
                            )}
                            {!t.isSplit && (
                              <button
                                type="button"
                                className="shrink-0 text-base leading-none opacity-70 hover:opacity-100"
                                title="Edit party name"
                                onClick={() => startInline(t, 'partyName')}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 max-w-[140px] align-top">
                          <div className="flex items-start gap-1">
                            {inline?.id === t.id && inline.field === 'description' ? (
                              <input
                                ref={descRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => commitInline()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitInline();
                                  if (e.key === 'Escape') cancelInline();
                                }}
                                className="w-full min-w-[120px] border rounded px-2 py-1 text-sm"
                              />
                            ) : (
                              <span className="flex-1 truncate" title={t.description ?? undefined}>
                                {t.description ?? '—'}
                              </span>
                            )}
                            {!t.isSplit && (
                              <button
                                type="button"
                                className="shrink-0 text-base leading-none opacity-70 hover:opacity-100"
                                title="Edit description"
                                onClick={() => startInline(t, 'description')}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-rose-600 font-medium whitespace-nowrap">
                          {t.type === 'EXPENSE' ? fmt(t.amount) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap">
                          {t.type === 'INCOME' ? fmt(t.amount) : '—'}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={t.category?.id ?? ''}
                            onChange={(e) => handleCategoryChange(t, e.target.value || null)}
                            disabled={!!t.isSplit}
                            className="border rounded px-2 py-1 text-xs min-w-[90px] disabled:bg-gray-100"
                          >
                            <option value="">—</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={t.site?.id ?? ''}
                            onChange={(e) => handleSiteChange(t, e.target.value || null)}
                            disabled={!!t.isSplit}
                            className="border rounded px-2 py-1 text-xs min-w-[90px] disabled:bg-gray-100"
                          >
                            <option value="">—</option>
                            {sites.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <BillAttachmentCell
                            transactionId={t.id}
                            purchaseBill={t.purchaseBill}
                            salesBill={t.salesBill}
                            onUpdated={onTransactionsRefresh}
                            disabled={!!t.isSplit}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            {!t.isSplit ? (
                              <button
                                type="button"
                                onClick={() => createSplit(t)}
                                className="text-left text-xs font-medium text-blue-600 hover:text-blue-800"
                              >
                                Split
                              </button>
                            ) : (
                              <>
                                <span className="text-xs text-gray-500">Split lines</span>
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 hover:underline"
                                    onClick={() => addSplitRow(t)}
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-gray-600 hover:underline"
                                    onClick={() => autoDistribute(t)}
                                  >
                                    Balance
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-red-600 hover:underline"
                                    onClick={() => clearSplits(t)}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </>
                            )}
                            {splitErr[t.id] && (
                              <span className="text-xs text-red-600">{splitErr[t.id]}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                {t.isSplit &&
                  (t.splits ?? []).map((sp) => (
                    <tr key={sp.id} className="bg-slate-50/80">
                      <td />
                      <td />
                      <td />
                        <td colSpan={2} className="px-3 py-2 pl-8 border-l-2 border-blue-300">
                          <span className="text-xs text-gray-500">Split · </span>
                          <input
                            key={`d-${sp.id}`}
                            defaultValue={sp.description ?? ''}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (sp.description ?? '')) patchSplit(t, sp, { description: v || null });
                            }}
                            className="w-full max-w-xs border rounded px-2 py-0.5 text-xs"
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {t.type === 'EXPENSE' ? (
                            <input
                              type="number"
                              step="0.01"
                              key={`a-${sp.id}-${sp.amount}`}
                              defaultValue={sp.amount}
                              onBlur={(e) => {
                                const n = parseFloat(e.target.value);
                                if (!Number.isFinite(n)) return;
                                if (Math.abs(n - sp.amount) > 0.001) patchSplit(t, sp, { amount: n });
                              }}
                              className="w-24 border rounded px-2 py-0.5 text-right text-xs text-rose-700"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {t.type === 'INCOME' ? (
                            <input
                              type="number"
                              step="0.01"
                              key={`c-${sp.id}-${sp.amount}`}
                              defaultValue={sp.amount}
                              onBlur={(e) => {
                                const n = parseFloat(e.target.value);
                                if (!Number.isFinite(n)) return;
                                if (Math.abs(n - sp.amount) > 0.001) patchSplit(t, sp, { amount: n });
                              }}
                              className="w-24 border rounded px-2 py-0.5 text-right text-xs text-emerald-700"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={sp.categoryId}
                            onChange={(e) => patchSplit(t, sp, { categoryId: e.target.value })}
                            className="border rounded px-2 py-1 text-xs min-w-[90px]"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={sp.siteId ?? ''}
                            onChange={(e) => patchSplit(t, sp, { siteId: e.target.value || null })}
                            className="border rounded px-2 py-1 text-xs min-w-[90px]"
                          >
                            <option value="">—</option>
                            {sites.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <BillAttachmentCell
                            transactionId={t.id}
                            splitId={sp.id}
                            purchaseBill={sp.purchaseBill}
                            salesBill={sp.salesBill}
                            onUpdated={onTransactionsRefresh}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => deleteSplit(t, sp)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
    </div>
  );
}
