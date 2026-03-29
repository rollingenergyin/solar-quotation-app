'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import BankTransactionsTable, { type BankTx } from './BankTransactionsTable';
import AddTransactionModal from './AddTransactionModal';
import { downloadBankTransactionsExcel, downloadBankTransactionsPdf } from './exportBankTransactions';

type BankTransaction = BankTx;

interface TransactionCategory {
  id: string;
  name: string;
}

interface BankUpload {
  id: string;
  fileName: string;
  createdAt: string;
  _count: { transactions: number };
}

interface FinanceSite {
  id: string;
  name: string;
}

interface Summary {
  byCategory: Record<string, number>;
  uncategorizedCount: number;
  totalIncome: number;
  totalExpense: number;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

export default function BankTransactionsPage() {
  const searchParams = useSearchParams();
  const uploadIdFromUrl = searchParams.get('uploadId');
  const [uploads, setUploads] = useState<BankUpload[]>([]);
  const [sites, setSites] = useState<FinanceSite[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUploadId, setSelectedUploadId] = useState<string>('');
  const [sortDate, setSortDate] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [categoryFilterMode, setCategoryFilterMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewTrash, setViewTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSiteId, setBulkSiteId] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showEditCategories, setShowEditCategories] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [showNewSite, setShowNewSite] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSiteClientId, setNewSiteClientId] = useState('');
  const [newSiteProjectId, setNewSiteProjectId] = useState('');
  const [showNewClientInModal, setShowNewClientInModal] = useState(false);
  const [showNewProjectInModal, setShowNewProjectInModal] = useState(false);
  const [newClientNameInModal, setNewClientNameInModal] = useState('');
  const [newProjectNameInModal, setNewProjectNameInModal] = useState('');
  const [siteErrorInModal, setSiteErrorInModal] = useState('');
  const [modalProjects, setModalProjects] = useState<FinanceSite[]>([]);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const refreshTrashCount = useCallback(() => {
    if (!selectedUploadId) return;
    const p = new URLSearchParams({ uploadId: selectedUploadId, trash: 'true', limit: '1' });
    api<{ total: number }>(`/finance/bank-transactions?${p}`)
      .then((r) => setTrashCount(r.total))
      .catch(() => setTrashCount(0));
  }, [selectedUploadId]);

  const fetchTransactions = () => {
    if (!selectedUploadId) return;
    setLoading(true);
    const params = new URLSearchParams({
      uploadId: selectedUploadId,
      limit: '500',
      sortDate,
    });
    if (viewTrash) params.set('trash', 'true');
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (uncategorizedOnly) params.set('uncategorized', 'true');
    else if (categoryFilterMode === 'include' && selectedCategoryIds.size > 0) {
      params.set('categories', Array.from(selectedCategoryIds).join(','));
    } else if (categoryFilterMode === 'exclude' && selectedCategoryIds.size > 0) {
      params.set('excludeCategories', Array.from(selectedCategoryIds).join(','));
    } else if (filterCategory) params.set('category', filterCategory);
    api<{ transactions: BankTransaction[]; total: number }>(`/finance/bank-transactions?${params}`)
      .then((r) => {
        setTransactions(r.transactions);
        setTotal(r.total);
      })
      .catch(() => [])
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api<BankUpload[]>('/finance/bank-uploads')
      .then((u) => {
        setUploads(u);
        if (u.length > 0) {
          const validFromUrl = uploadIdFromUrl && u.some((x) => x.id === uploadIdFromUrl);
          setSelectedUploadId(validFromUrl ? uploadIdFromUrl! : u[0].id);
        } else {
          setSelectedUploadId('');
        }
      })
      .catch(() => []);
  }, [uploadIdFromUrl]);

  useEffect(() => {
    api<FinanceSite[]>('/finance/sites')
      .then(setSites)
      .catch(() => []);
  }, []);

  useEffect(() => {
    api<{ id: string; name: string }[]>('/finance/clients')
      .then(setClients)
      .catch(() => []);
  }, []);

  useEffect(() => {
    if (!showNewSite) return;
    setNewSiteClientId('');
    setNewSiteProjectId('');
    setShowNewClientInModal(false);
    setShowNewProjectInModal(false);
    setNewClientNameInModal('');
    setNewProjectNameInModal('');
    setSiteErrorInModal('');
    setModalProjects([]);
  }, [showNewSite]);

  useEffect(() => {
    if (!newSiteClientId) {
      setModalProjects([]);
      setNewSiteProjectId('');
      return;
    }
    api<FinanceSite[]>(`/finance/sites?clientId=${newSiteClientId}`)
      .then(setModalProjects)
      .catch(() => setModalProjects([]));
    setNewSiteProjectId('');
  }, [newSiteClientId, showNewSite]);

  useEffect(() => {
    api<TransactionCategory[]>('/finance/transaction-categories')
      .then(setCategories)
      .catch(() => []);
  }, []);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetchTransactions();
  }, [selectedUploadId, sortDate, typeFilter, uncategorizedOnly, filterCategory, categoryFilterMode, selectedCategoryIds, viewTrash]);

  useEffect(() => {
    refreshTrashCount();
  }, [refreshTrashCount]);

  useEffect(() => {
    if (!showCategoryFilter) return;
    const close = () => setShowCategoryFilter(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showCategoryFilter]);

  const refreshSummary = useCallback(() => {
    if (!selectedUploadId) return;
    const params = new URLSearchParams({ uploadId: selectedUploadId });
    api<Summary>(`/finance/bank-transactions/summary?${params}`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [selectedUploadId]);

  useEffect(() => {
    refreshSummary();
  }, [selectedUploadId, transactions, refreshSummary]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(transactions.map((t) => t.id)));
  };

  const handleBulkAssign = async (field: 'category' | 'siteId' | 'isReviewed') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkError(null);
    const body: Record<string, unknown> = { ids };
    if (field === 'category') body.categoryId = bulkCategory || null;
    else if (field === 'siteId') body.siteId = bulkSiteId || null;
    else if (field === 'isReviewed') body.isReviewed = true;
    try {
      await api('/finance/bank-transactions/bulk', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSelectedIds(new Set());
      fetchTransactions();
      if (summary) {
        const p = new URLSearchParams({ uploadId: selectedUploadId });
        api<Summary>(`/finance/bank-transactions/summary?${p}`).then(setSummary).catch(() => {});
      }
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Bulk update failed');
    }
  };

  /** Main list: move selected rows to recycle bin (soft delete). */
  const handleBulkDeleteToRecycleBin = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !selectedUploadId) return;
    setBulkError(null);
    if (
      !window.confirm(
        `Move ${ids.length} transaction(s) to the recycle bin? They will be removed from totals, categories, and projects until you restore or permanently delete them.`
      )
    )
      return;
    try {
      await api('/finance/bank-transactions/bulk-soft-delete', {
        method: 'POST',
        body: JSON.stringify({ ids, uploadId: selectedUploadId }),
      });
      setSelectedIds(new Set());
      fetchTransactions();
      refreshTrashCount();
      refreshSummary();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Failed to move to recycle bin');
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !selectedUploadId) return;
    setBulkError(null);
    try {
      await api('/finance/bank-transactions/bulk-restore', {
        method: 'POST',
        body: JSON.stringify({ ids, uploadId: selectedUploadId }),
      });
      setSelectedIds(new Set());
      fetchTransactions();
      refreshTrashCount();
      refreshSummary();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Failed to restore');
    }
  };

  const handleBulkPermanentDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !selectedUploadId) return;
    setBulkError(null);
    if (!window.confirm(`Permanently delete ${ids.length} transaction(s)? This cannot be undone.`)) return;
    try {
      await api('/finance/bank-transactions/bulk-permanent-delete', {
        method: 'POST',
        body: JSON.stringify({ ids, uploadId: selectedUploadId }),
      });
      setSelectedIds(new Set());
      fetchTransactions();
      refreshTrashCount();
      refreshSummary();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const cat = await api<TransactionCategory>('/finance/transaction-categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch {
      // ignore
    }
  };

  const handleStartEditCategory = (cat: TransactionCategory) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    try {
      const updated = await api<TransactionCategory>(`/finance/transaction-categories/${editingCategoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editingCategoryName.trim() }),
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategoryId ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setTransactions((prev) =>
        prev.map((t) =>
          t.category?.id === editingCategoryId ? { ...t, category: updated } : t
        )
      );
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } catch {
      // ignore
    }
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleCreateClientInModal = async () => {
    if (!newClientNameInModal.trim()) return;
    try {
      const client = await api<{ id: string; name: string }>('/finance/clients', {
        method: 'POST',
        body: JSON.stringify({ name: newClientNameInModal.trim() }),
      });
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSiteClientId(client.id);
      setNewClientNameInModal('');
      setShowNewClientInModal(false);
    } catch {
      // ignore
    }
  };

  const handleCreateProjectInModal = async () => {
    if (!newProjectNameInModal.trim() || !newSiteClientId) return;
    setSiteErrorInModal('');
    try {
      const site = await api<FinanceSite>('/finance/sites', {
        method: 'POST',
        body: JSON.stringify({ name: newProjectNameInModal.trim(), clientId: newSiteClientId }),
      });
      setSites((prev) => [...prev, site].sort((a, b) => a.name.localeCompare(b.name)));
      setModalProjects((prev) => [...prev, site].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSiteProjectId(site.id);
      setNewProjectNameInModal('');
      setShowNewProjectInModal(false);
      setShowNewSite(false);
    } catch (e) {
      setSiteErrorInModal(e instanceof Error ? e.message : 'Failed to create project');
    }
  };

  const hasSelection = selectedIds.size > 0;

  const exportBaseFilename = () => {
    const raw = uploads.find((u) => u.id === selectedUploadId)?.fileName ?? 'bank-transactions';
    const base = raw.replace(/\.[^.]+$/, '');
    return `${base}-transactions-${new Date().toISOString().slice(0, 10)}`;
  };

  const handleExportExcel = () => {
    downloadBankTransactionsExcel(transactions, exportBaseFilename());
  };

  const handleExportPdf = async () => {
    setExportBusy(true);
    try {
      await downloadBankTransactionsPdf(transactions, exportBaseFilename());
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1600px]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Bank Transactions</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddTransaction(true)}
            disabled={uploads.length === 0 || viewTrash}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add transaction
          </button>
          <Link href="/admin/finance/bank-upload" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
            + Upload Statement
          </Link>
        </div>
      </div>

      {uploads.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload</label>
              <select
                value={selectedUploadId}
                onChange={(e) => setSelectedUploadId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {uploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fileName} ({u._count.transactions} txns)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-2 text-sm font-medium ${
                      typeFilter === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'ALL' ? 'All' : t === 'INCOME' ? 'Received' : 'Expense'}
                  </button>
                ))}
              </div>
            </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort by date</label>
            <select
              value={sortDate}
              onChange={(e) => setSortDate(e.target.value as 'asc' | 'desc')}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewTrash((v) => !v);
              setSelectedIds(new Set());
              setBulkError(null);
            }}
            className={`px-3 py-2 rounded-lg border text-sm font-medium inline-flex items-center gap-2 ${
              viewTrash
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span aria-hidden>♻️</span>
            Recycle bin
            {!viewTrash && trashCount > 0 && (
              <span className="text-xs rounded-full bg-amber-200 px-2 py-0.5 font-semibold tabular-nums">{trashCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowNewSite(true)}
            className="px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 text-sm font-medium"
          >
            + New Project
          </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={uncategorizedOnly}
                onChange={(e) => {
                  setUncategorizedOnly(e.target.checked);
                  if (e.target.checked) {
                  setFilterCategory('');
                  setCategoryFilterMode('all');
                  setSelectedCategoryIds(new Set());
                }
                }}
              />
              <span className="text-sm text-gray-700">Uncategorized only</span>
            </label>
            {!uncategorizedOnly && (
              <div className="flex items-end gap-1 relative">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by category</label>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowCategoryFilter(!showCategoryFilter); }}
                    className="border rounded-lg px-3 py-2 text-sm text-left min-w-[180px] flex items-center justify-between gap-2 bg-white"
                  >
                    <span>
                      {categoryFilterMode === 'all'
                        ? 'All categories'
                        : categoryFilterMode === 'include'
                          ? `Show ${selectedCategoryIds.size} selected`
                          : `Hide ${selectedCategoryIds.size} selected`}
                    </span>
                    <span className="text-gray-400">{showCategoryFilter ? '▲' : '▼'}</span>
                  </button>
                  {showCategoryFilter && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-lg py-2 min-w-[220px] max-h-64 overflow-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="px-3 py-2 border-b space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={categoryFilterMode === 'all'} onChange={() => { setCategoryFilterMode('all'); setSelectedCategoryIds(new Set()); }} />
                          <span className="text-xs">All categories</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={categoryFilterMode === 'include'} onChange={() => setCategoryFilterMode('include')} />
                          <span className="text-xs">Show only selected</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={categoryFilterMode === 'exclude'} onChange={() => setCategoryFilterMode('exclude')} />
                          <span className="text-xs">Hide selected</span>
                        </label>
                      </div>
                      <div className="px-3 py-2 max-h-40 overflow-auto">
                        {categories.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 py-1 px-2 rounded">
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.has(c.id)}
                              onChange={(e) => {
                                setSelectedCategoryIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(c.id);
                                  else next.delete(c.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm">{c.name.replace(/_/g, ' ')}</span>
                          </label>
                        ))}
                      </div>
                      {(categoryFilterMode === 'include' || categoryFilterMode === 'exclude') && selectedCategoryIds.size > 0 && (
                        <div className="px-3 py-2 border-t">
                          <button
                            type="button"
                            onClick={() => setSelectedCategoryIds(new Set())}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowNewCategory(true)}
                  className="px-2 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm"
                  title="New Category"
                >
                  + Category
                </button>
                <button
                  onClick={() => setShowEditCategories(true)}
                  className="px-2 py-2 rounded-lg border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 text-sm"
                  title="Edit Categories"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {summary && !viewTrash && (
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <button
                onClick={() => {
                  setUncategorizedOnly(true);
                  setFilterCategory('');
                  setCategoryFilterMode('all');
                  setSelectedCategoryIds(new Set());
                }}
                className="p-3 rounded-lg border bg-amber-50 border-amber-200 hover:bg-amber-100 text-left"
              >
                <div className="text-xs text-amber-700 font-medium">Uncategorized</div>
                <div className="text-lg font-semibold text-amber-800">{summary.uncategorizedCount}</div>
              </button>
              {Object.entries(summary.byCategory).map(([cat, amt]) => {
                if (cat === 'UNCATEGORIZED') return null;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setUncategorizedOnly(false);
                      setFilterCategory('');
                      setCategoryFilterMode('include');
                      const catObj = categories.find((c) => c.name === cat || c.id === cat);
                      if (catObj) setSelectedCategoryIds(new Set([catObj.id]));
                    }}
                    className="p-3 rounded-lg border bg-gray-50 border-gray-200 hover:bg-gray-100 text-left"
                  >
                    <div className="text-xs text-gray-600 font-medium truncate">{cat.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-semibold text-gray-900">{fmt(amt)}</div>
                  </button>
                );
              })}
              <div className="p-3 rounded-lg border bg-emerald-50 border-emerald-200 text-left">
                <div className="text-xs text-emerald-700 font-medium">Received</div>
                <div className="text-lg font-semibold text-emerald-800">{fmt(summary.totalIncome)}</div>
              </div>
              <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-left">
                <div className="text-xs text-rose-700 font-medium">Expense</div>
                <div className="text-lg font-semibold text-rose-800">{fmt(summary.totalExpense)}</div>
              </div>
            </div>
          )}

          {hasSelection && (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200 flex flex-wrap items-center gap-3">
              {bulkError && (
                <span className="w-full text-sm text-red-600 mb-1">{bulkError}</span>
              )}
              <span className="text-sm font-medium text-blue-800">
                {selectedIds.size} selected
              </span>
              {!viewTrash && (
                <>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <select
                      value={bulkSiteId}
                      onChange={(e) => setBulkSiteId(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm"
                    >
                      <option value="">Project</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewSite(true)}
                      className="px-2 py-1.5 rounded border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-xs"
                      title="New Project"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleBulkAssign('category')}
                    disabled={!bulkCategory}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Assign category
                  </button>
                  <button
                    onClick={() => handleBulkAssign('siteId')}
                    disabled={!bulkSiteId}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Assign project
                  </button>
                  <button
                    onClick={() => handleBulkAssign('isReviewed')}
                    className="px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium"
                  >
                    Mark as reviewed
                  </button>
                </>
              )}
              {!viewTrash && (
                <button
                  type="button"
                  onClick={handleBulkDeleteToRecycleBin}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-1.5"
                >
                  <span aria-hidden>🗑️</span>
                  Delete
                </button>
              )}
              {viewTrash && (
                <>
                  <button
                    type="button"
                    onClick={handleBulkRestore}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkPermanentDelete}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    Delete permanently
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedIds(new Set()); setBulkError(null); }}
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-sm"
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {viewTrash
                ? 'Recycle bin is empty.'
                : 'No transactions. Upload a bank statement or adjust filters.'}
            </div>
          ) : (
            <div className="border-t border-gray-100">
              <div
                className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
                  viewTrash ? 'bg-amber-50/90 border-amber-200 text-amber-900' : 'bg-gray-50/80 border-gray-100 text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                    onChange={toggleSelectAll}
                  />
                  {viewTrash ? (
                    <span>Recycle bin — select rows to restore or delete permanently</span>
                  ) : (
                    <span>Select all for bulk actions</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={exportBusy}
                    className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-800 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Download Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={exportBusy}
                    className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-800 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {exportBusy ? 'Preparing PDF…' : 'Download PDF'}
                  </button>
                </div>
              </div>
              <BankTransactionsTable
                uploadId={selectedUploadId}
                transactions={transactions}
                setTransactions={setTransactions}
                categories={categories}
                sites={sites}
                onTotalsRefresh={refreshSummary}
                onTransactionsRefresh={fetchTransactions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                disableDrag={viewTrash}
              />
            </div>
          )}
        </div>
      )}

      {showEditCategories && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowEditCategories(false); handleCancelEditCategory(); }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Edit Categories</h3>
            <ul className="space-y-2 mb-4">
              {categories.map((cat) => (
                <li key={cat.id} className="flex items-center gap-2">
                  {editingCategoryId === cat.id ? (
                    <>
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="flex-1 border rounded px-3 py-1.5 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEditCategory()}
                        autoFocus
                      />
                      <button onClick={handleSaveEditCategory} className="px-2 py-1 text-green-600 text-sm font-medium">Save</button>
                      <button onClick={handleCancelEditCategory} className="px-2 py-1 text-gray-500 text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-gray-800">{cat.name.replace(/_/g, ' ')}</span>
                      <button onClick={() => handleStartEditCategory(cat)} className="px-2 py-1 text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Edit
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <button onClick={() => { setShowEditCategories(false); handleCancelEditCategory(); }} className="px-4 py-2 rounded-lg border border-gray-300">
              Done
            </button>
          </div>
        </div>
      )}

      {showNewCategory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewCategory(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Category</h3>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="w-full border rounded-lg px-3 py-2 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
            />
            <div className="flex gap-2">
              <button onClick={handleCreateCategory} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
                Create
              </button>
              <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="px-4 py-2 rounded-lg border border-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewSite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewSite(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">New Project</h3>
            <p className="text-sm text-gray-600 mb-4">First select or create a <strong>Client</strong>, then create/select a <strong>Project</strong> under that client.</p>
            {siteErrorInModal && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{siteErrorInModal}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client *</label>
                <div className="flex gap-2">
                  <select
                    value={newSiteClientId}
                    onChange={(e) => setNewSiteClientId(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2"
                  >
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewClientInModal(true)}
                    className="px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 text-sm font-medium"
                  >
                    + New
                  </button>
                </div>
                {showNewClientInModal && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newClientNameInModal}
                      onChange={(e) => setNewClientNameInModal(e.target.value)}
                      placeholder="Client name"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={handleCreateClientInModal} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Add</button>
                    <button type="button" onClick={() => { setShowNewClientInModal(false); setNewClientNameInModal(''); }} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Project *</label>
                <div className="flex gap-2">
                  <select
                    value={newSiteProjectId}
                    onChange={(e) => setNewSiteProjectId(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2"
                    disabled={!newSiteClientId}
                  >
                    <option value="">Select project…</option>
                    {modalProjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setShowNewProjectInModal(true); setSiteErrorInModal(''); }}
                    disabled={!newSiteClientId}
                    title={!newSiteClientId ? 'Select a client first' : 'Add new project'}
                    className="px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + New
                  </button>
                </div>
                {showNewProjectInModal && newSiteClientId && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={newProjectNameInModal}
                        onChange={(e) => setNewProjectNameInModal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateProjectInModal())}
                        placeholder="Project name"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        autoFocus
                      />
                      <button type="button" onClick={handleCreateProjectInModal} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Add</button>
                      <button type="button" onClick={() => { setShowNewProjectInModal(false); setNewProjectNameInModal(''); setSiteErrorInModal(''); }} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowNewSite(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium"
              >
                Close
              </button>
              {newSiteProjectId && (
                <button
                  onClick={() => setShowNewSite(false)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <AddTransactionModal
        open={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        uploads={uploads}
        categories={categories}
        sites={sites}
        selectedUploadId={selectedUploadId}
        sortDate={sortDate}
        disabled={viewTrash}
        onCreated={() => {
          fetchTransactions();
          refreshSummary();
          refreshTrashCount();
        }}
      />
    </div>
  );
}
