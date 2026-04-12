'use client';

import { Fragment, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import BillAttachmentCell from './BillAttachmentCell';
import type { LinkedFinanceBill } from './BillAttachmentCell';
import {
  ProjectSiteSelect,
  displayProjectSiteLabel,
  type FinanceProjectRow,
  type SiteRow,
} from './projectSiteSelect';

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Match Order column: stacked small buttons; shell uses translucent tint per tag type */
const orderBtnBase =
  'leading-none px-1.5 py-0.5 rounded border text-[10px] font-bold disabled:opacity-30 disabled:cursor-not-allowed w-9 min-h-[22px]';

function InvoiceTagStack({
  value,
  onChange,
  disabled,
}: {
  value: 'INV' | 'NO_INV' | null | undefined;
  onChange: (next: 'INV' | 'NO_INV' | null) => void;
  disabled?: boolean;
}) {
  const v = value ?? null;
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded border border-emerald-400/35 bg-emerald-500/[0.12] px-0.5 py-0.5"
      title="Invoice: INV or NO INV"
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Tag as INV"
        aria-pressed={v === 'INV'}
        onClick={() => onChange(v === 'INV' ? null : 'INV')}
        className={`${orderBtnBase} ${
          v === 'INV'
            ? 'border-emerald-500/70 bg-emerald-500/35 text-emerald-950 shadow-sm'
            : 'border-gray-200/90 bg-white/70 text-gray-700 hover:bg-white'
        }`}
      >
        INV
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="Tag as NO INV"
        aria-pressed={v === 'NO_INV'}
        onClick={() => onChange(v === 'NO_INV' ? null : 'NO_INV')}
        className={`${orderBtnBase} ${
          v === 'NO_INV'
            ? 'border-amber-500/70 bg-amber-500/30 text-amber-950 shadow-sm'
            : 'border-gray-200/90 bg-white/70 text-gray-700 hover:bg-white'
        }`}
      >
        NO
      </button>
    </div>
  );
}

function BillUploadTagStack({
  value,
  onChange,
  disabled,
}: {
  value: 'UPLOADED' | 'NOT_UPLOADED' | null | undefined;
  onChange: (next: 'UPLOADED' | 'NOT_UPLOADED' | null) => void;
  disabled?: boolean;
}) {
  const v = value ?? null;
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded border border-sky-400/35 bg-sky-500/[0.12] px-0.5 py-0.5"
      title="Bill upload: UP or NO UP"
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Tag as uploaded"
        aria-pressed={v === 'UPLOADED'}
        onClick={() => onChange(v === 'UPLOADED' ? null : 'UPLOADED')}
        className={`${orderBtnBase} ${
          v === 'UPLOADED'
            ? 'border-emerald-500/70 bg-emerald-500/30 text-emerald-950 shadow-sm'
            : 'border-gray-200/90 bg-white/70 text-gray-700 hover:bg-white'
        }`}
      >
        UP
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="Tag as not uploaded"
        aria-pressed={v === 'NOT_UPLOADED'}
        onClick={() => onChange(v === 'NOT_UPLOADED' ? null : 'NOT_UPLOADED')}
        className={`${orderBtnBase} ${
          v === 'NOT_UPLOADED'
            ? 'border-rose-500/70 bg-rose-500/25 text-rose-950 shadow-sm'
            : 'border-gray-200/90 bg-white/70 text-gray-700 hover:bg-white'
        }`}
      >
        NO
      </button>
    </div>
  );
}

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
  invoiceStatus?: 'INV' | 'NO_INV' | null;
  billUploadStatus?: 'UPLOADED' | 'NOT_UPLOADED' | null;
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
  /** Present on API payload even when `site` join is null */
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  splits?: TxSplit[];
  purchaseBill?: LinkedFinanceBill | null;
  salesBill?: LinkedFinanceBill | null;
  invoiceStatus?: 'INV' | 'NO_INV' | null;
  billUploadStatus?: 'UPLOADED' | 'NOT_UPLOADED' | null;
}

interface Props {
  uploadId: string;
  transactions: BankTx[];
  setTransactions: React.Dispatch<React.SetStateAction<BankTx[]>>;
  categories: { id: string; name: string }[];
  sites: SiteRow[];
  /** Finance projects (linked to sites); drives project labels in the Project column */
  projects: FinanceProjectRow[];
  onTotalsRefresh: () => void;
  onTransactionsRefresh: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  /** Recycle-bin view: row reordering disabled */
  disableDrag?: boolean;
  /** When set with category filter, split rows show only matching lines; totals use those amounts only. */
  categoryFilterMode?: 'all' | 'include' | 'exclude';
  selectedCategoryIdsList?: readonly string[];
  filterCategory?: string;
}

type CategoryFilterState =
  | { kind: 'none' }
  | { kind: 'include'; ids: Set<string> }
  | { kind: 'exclude'; ids: Set<string> };

function buildCategoryFilterState(
  mode: 'all' | 'include' | 'exclude',
  selectedIds: readonly string[],
  filterCategory: string,
  categoryRows: { id: string; name: string }[]
): CategoryFilterState {
  const fc = filterCategory.trim();
  if (fc) {
    const byId = categoryRows.find((c) => c.id === fc);
    const byName = categoryRows.find((c) => c.name === fc);
    const id = byId?.id ?? byName?.id ?? fc;
    return { kind: 'include', ids: new Set([id]) };
  }
  if (mode === 'include' && selectedIds.length > 0) {
    return { kind: 'include', ids: new Set(selectedIds) };
  }
  if (mode === 'exclude' && selectedIds.length > 0) {
    return { kind: 'exclude', ids: new Set(selectedIds) };
  }
  return { kind: 'none' };
}

/** For split txns under a category filter: only matching split lines and their sum for display/totals. */
function splitAmountsForCategoryFilter(
  t: BankTx,
  cf: CategoryFilterState
): { splits: TxSplit[]; scopedAmount: number } {
  if (cf.kind === 'none') {
    return { splits: t.splits ?? [], scopedAmount: t.amount };
  }
  if (!t.isSplit) {
    return { splits: [], scopedAmount: t.amount };
  }
  const splits = t.splits ?? [];
  if (cf.kind === 'include') {
    const filtered = splits.filter((s) => cf.ids.has(s.categoryId));
    const sum = filtered.reduce((a, s) => a + Number(s.amount), 0);
    return { splits: filtered, scopedAmount: sum };
  }
  const filtered = splits.filter((s) => !cf.ids.has(s.categoryId));
  const sum = filtered.reduce((a, s) => a + Number(s.amount), 0);
  return { splits: filtered, scopedAmount: sum };
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
  projects,
  onTotalsRefresh,
  onTransactionsRefresh,
  selectedIds,
  onToggleSelect,
  disableDrag = false,
  categoryFilterMode = 'all',
  selectedCategoryIdsList = [] as readonly string[],
  filterCategory = '',
}: Props) {
  const [inline, setInline] = useState<{ id: string; field: 'partyName' | 'description' } | null>(null);
  const [draft, setDraft] = useState('');
  const [splitErr, setSplitErr] = useState<Record<string, string>>({});
  const partyRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLInputElement | null>(null);

  const categoryFilterState = useMemo(
    () => buildCategoryFilterState(categoryFilterMode, selectedCategoryIdsList, filterCategory, categories),
    [categoryFilterMode, selectedCategoryIdsList, filterCategory, categories]
  );

  const listTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const t of transactions) {
      const { scopedAmount } = splitAmountsForCategoryFilter(t, categoryFilterState);
      if (t.type === 'EXPENSE') totalDebit += scopedAmount;
      else if (t.type === 'INCOME') totalCredit += scopedAmount;
    }
    const net = totalCredit - totalDebit;
    return {
      totalDebit,
      totalCredit,
      net,
      parentRowCount: transactions.length,
      filterActive: categoryFilterState.kind !== 'none',
    };
  }, [transactions, categoryFilterState]);

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

  const handleInvoiceTagChange = async (t: BankTx, raw: '' | 'INV' | 'NO_INV') => {
    if (t.isSplit) return;
    const invoiceStatus = raw === '' ? null : raw;
    await patchTx(t.id, { invoiceStatus });
  };

  const handleBillUploadTagChange = async (
    t: BankTx,
    raw: '' | 'UPLOADED' | 'NOT_UPLOADED'
  ) => {
    if (t.isSplit) return;
    const billUploadStatus = raw === '' ? null : raw;
    await patchTx(t.id, { billUploadStatus });
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

  /** Read split amount inputs in the table and PATCH batch (parent row control). */
  const saveSplitAmountsBatch = async (t: BankTx) => {
    const splits = t.splits ?? [];
    if (splits.length === 0) return;
    const nodes = document.querySelectorAll<HTMLInputElement>(
      `input[data-bank-split-txn="${t.id}"][data-split-id]`
    );
    const bySplitId = new Map<string, number>();
    nodes.forEach((el) => {
      const sid = el.getAttribute('data-split-id');
      if (!sid) return;
      const n = parseFloat(el.value);
      if (!Number.isFinite(n)) return;
      bySplitId.set(sid, n);
    });
    const amounts = splits.map((sp) => ({
      splitId: sp.id,
      amount: bySplitId.has(sp.id) ? bySplitId.get(sp.id)! : sp.amount,
    }));
    if (amounts.some((a) => !Number.isFinite(a.amount))) {
      setSplitErr((s) => ({ ...s, [t.id]: 'Enter a valid amount on each split line.' }));
      return;
    }
    const sum = amounts.reduce((s, x) => s + x.amount, 0);
    if (!sumSplitsOk(t.amount, amounts)) {
      setSplitErr((s) => ({
        ...s,
        [t.id]: `Splits must sum to ${fmt(t.amount)} (now ${fmt(sum)})`,
      }));
      return;
    }
    try {
      const updated = await api<TxSplit[]>(`/finance/bank-transactions/${t.id}/split-amounts`, {
        method: 'PATCH',
        body: JSON.stringify({ amounts }),
      });
      setTransactions((prev) =>
        prev.map((x) => {
          if (x.id !== t.id || !x.splits) return x;
          return {
            ...x,
            splits: updated.map((sp) => ({
              ...sp,
              category: categories.find((c) => c.id === sp.categoryId) ?? sp.category,
              site: sp.siteId ? sites.find((si) => si.id === sp.siteId) ?? null : null,
            })),
          };
        })
      );
      setSplitErr((s) => ({ ...s, [t.id]: '' }));
      onTotalsRefresh();
      onTransactionsRefresh();
    } catch (err) {
      setSplitErr((s) => ({
        ...s,
        [t.id]: err instanceof Error ? err.message : 'Save amounts failed',
      }));
    }
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
          ...(body.invoiceStatus !== undefined ? { invoiceStatus: body.invoiceStatus } : {}),
          ...(body.billUploadStatus !== undefined ? { billUploadStatus: body.billUploadStatus } : {}),
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
      setSplitErr((s) => ({ ...s, [t.id]: '' }));
      onTotalsRefresh();
      /** Server merges the removed line’s amount into another split; refetch so UI matches DB. */
      onTransactionsRefresh();
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
            <th className="px-1 py-2 w-8 text-center text-xs font-semibold text-gray-600" title="Serial number">
              Sr.
            </th>
            <th className="px-0.5 py-2 w-9 text-center text-xs font-semibold text-gray-600" title="Move row">
              Order
            </th>
            <th className="px-2 py-3 w-10">
              <span className="sr-only">Select</span>
            </th>
            <th
              className="px-1.5 py-3 text-left text-xs font-semibold text-emerald-800"
              title="Invoice tag (GST)"
            >
              INV
            </th>
            <th
              className="px-1.5 py-3 text-left text-xs font-semibold text-emerald-800"
              title="Bill upload reminder"
            >
              UP
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
            {transactions.map((t, rowIndex) => {
              const parentProjectLabel = displayProjectSiteLabel(
                t.site?.id ?? t.siteId,
                t.site,
                sites,
                projects
              );
              const { splits: splitsVisible, scopedAmount } = splitAmountsForCategoryFilter(
                t,
                categoryFilterState
              );
              const splitFilterActive = categoryFilterState.kind !== 'none' && t.isSplit;
              return (
              <Fragment key={t.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-1 py-2 align-middle text-center tabular-nums text-xs font-semibold text-gray-600">
                    {rowIndex + 1}
                  </td>
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
                  <td className="px-0.5 py-2 align-middle">
                    {!t.isSplit ? (
                      <InvoiceTagStack
                        value={t.invoiceStatus}
                        onChange={(next) =>
                          handleInvoiceTagChange(t, next === null ? '' : next)
                        }
                      />
                    ) : (
                      <span
                        className="flex h-[52px] w-9 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/80 text-[10px] font-semibold text-slate-400"
                        title="Set on each split line"
                      >
                        ↓
                      </span>
                    )}
                  </td>
                  <td className="px-0.5 py-2 align-middle">
                    {!t.isSplit ? (
                      <BillUploadTagStack
                        value={t.billUploadStatus}
                        onChange={(next) =>
                          handleBillUploadTagChange(t, next === null ? '' : next)
                        }
                      />
                    ) : (
                      <span
                        className="flex h-[52px] w-9 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/80 text-[10px] font-semibold text-slate-400"
                        title="Set on each split line"
                      >
                        ↓
                      </span>
                    )}
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
                        <td
                          className="px-3 py-3 text-right text-rose-600 font-medium whitespace-nowrap"
                          title={splitFilterActive ? 'Expense amount for split lines matching the category filter' : undefined}
                        >
                          {t.type === 'EXPENSE' ? fmt(scopedAmount) : '—'}
                        </td>
                        <td
                          className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap"
                          title={splitFilterActive ? 'Income amount for split lines matching the category filter' : undefined}
                        >
                          {t.type === 'INCOME' ? fmt(scopedAmount) : '—'}
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
                        <td className="px-3 py-3 align-top max-w-[260px]">
                          <div className="flex flex-col gap-1">
                            {parentProjectLabel !== '—' && (
                              <span
                                className="text-xs text-gray-900 leading-snug line-clamp-3"
                                title={parentProjectLabel}
                              >
                                {parentProjectLabel}
                              </span>
                            )}
                            <ProjectSiteSelect
                              sites={sites}
                              projects={projects}
                              valueSiteId={t.site?.id ?? t.siteId ?? null}
                              onPickSiteId={(siteId) => handleSiteChange(t, siteId)}
                              disabled={!!t.isSplit}
                              className="w-full min-w-0 max-w-full text-[10px] py-0.5"
                            />
                          </div>
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
                                <div className="flex flex-wrap gap-1 items-center">
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 hover:underline"
                                    onClick={() => addSplitRow(t)}
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-emerald-700 hover:underline"
                                    title="Save all split line amounts (must sum to the row total)"
                                    onClick={() => saveSplitAmountsBatch(t)}
                                  >
                                    Save amounts
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
                  splitsVisible.map((sp) => {
                    const splitProjectLabel = displayProjectSiteLabel(
                      sp.siteId,
                      sp.site,
                      sites,
                      projects
                    );
                    return (
                    <tr key={sp.id} className="bg-slate-50/80">
                      <td />
                      <td />
                      <td />
                      <td className="px-0.5 py-2 align-middle">
                        <InvoiceTagStack
                          value={sp.invoiceStatus}
                          onChange={(next) =>
                            patchSplit(t, sp, { invoiceStatus: next })
                          }
                        />
                      </td>
                      <td className="px-0.5 py-2 align-middle">
                        <BillUploadTagStack
                          value={sp.billUploadStatus}
                          onChange={(next) =>
                            patchSplit(t, sp, { billUploadStatus: next })
                          }
                        />
                      </td>
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
                              data-bank-split-txn={t.id}
                              data-split-id={sp.id}
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
                              data-bank-split-txn={t.id}
                              data-split-id={sp.id}
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
                        <td className="px-3 py-2 align-top max-w-[260px]">
                          <div className="flex flex-col gap-1">
                            {splitProjectLabel !== '—' && (
                              <span
                                className="text-xs text-gray-900 leading-snug line-clamp-3"
                                title={splitProjectLabel}
                              >
                                {splitProjectLabel}
                              </span>
                            )}
                            <ProjectSiteSelect
                              sites={sites}
                              projects={projects}
                              valueSiteId={sp.siteId}
                              onPickSiteId={(siteId) => patchSplit(t, sp, { siteId })}
                              className="w-full min-w-0 max-w-full text-[10px] py-0.5"
                            />
                          </div>
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
                    );
                  })}
              </Fragment>
            );
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50/95">
            <tr>
              <td
                colSpan={8}
                className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700"
              >
                {`Total (${listTotals.parentRowCount} row${
                  listTotals.parentRowCount === 1 ? '' : 's'
                }${listTotals.filterActive ? ' · split lines matching category filter' : ''})`}
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-rose-700 whitespace-nowrap">
                {listTotals.totalDebit > 0 ? fmt(listTotals.totalDebit) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                {listTotals.totalCredit > 0 ? fmt(listTotals.totalCredit) : '—'}
              </td>
              <td colSpan={4} className="px-3 py-2.5 text-left text-xs text-gray-700">
                <span className="font-medium text-gray-600">Net (credit − debit): </span>
                <span
                  className={`font-bold tabular-nums ${
                    listTotals.net > 0
                      ? 'text-emerald-800'
                      : listTotals.net < 0
                        ? 'text-rose-800'
                        : 'text-gray-700'
                  }`}
                >
                  {fmt(listTotals.net)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
    </div>
  );
}
