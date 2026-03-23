'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

interface BankTransaction {
  id: string;
  transactionDate: string;
  amount: number;
  type: string;
  category?: { id: string; name: string } | null;
  description: string | null;
  partyName: string | null;
  referenceNo: string | null;
  manualOverride: boolean;
  site?: { id: string; name: string } | null;
}

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
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

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
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSiteId, setBulkSiteId] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BankTransaction>>({});
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

  const fetchTransactions = () => {
    if (!selectedUploadId) return;
    setLoading(true);
    const params = new URLSearchParams({
      uploadId: selectedUploadId,
      limit: '500',
      sortDate,
    });
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
  }, [selectedUploadId, sortDate, typeFilter, uncategorizedOnly, filterCategory, categoryFilterMode, selectedCategoryIds]);

  useEffect(() => {
    if (!showCategoryFilter) return;
    const close = () => setShowCategoryFilter(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showCategoryFilter]);

  useEffect(() => {
    if (!selectedUploadId) return;
    const params = new URLSearchParams({ uploadId: selectedUploadId });
    api<Summary>(`/finance/bank-transactions/summary?${params}`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [selectedUploadId, transactions]);

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

  const handleEdit = (t: BankTransaction) => {
    setEditingId(t.id);
    setEditForm({
      type: t.type,
      category: t.category ?? undefined,
      partyName: t.partyName,
      description: t.description,
      referenceNo: t.referenceNo,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const payload: Record<string, unknown> = {
        type: editForm.type,
        partyName: editForm.partyName,
        description: editForm.description,
        referenceNo: editForm.referenceNo,
        manualOverride: true,
      };
      if (editForm.category !== undefined) payload.categoryId = editForm.category?.id ?? null;
      await api(`/finance/bank-transactions/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setTransactions((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...editForm } : t))
      );
      setEditingId(null);
      setEditForm({});
    } catch {
      // ignore
    }
  };

  const handleCategoryChange = async (t: BankTransaction, categoryId: string | null) => {
    try {
      await api(`/finance/bank-transactions/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId: categoryId || null, manualOverride: true }),
      });
      const cat = categoryId ? categories.find((c) => c.id === categoryId) : null;
      setTransactions((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, category: cat ?? null } : x))
      );
    } catch {
      // ignore
    }
  };

  const handleSiteChange = async (t: BankTransaction, siteId: string | null) => {
    try {
      await api(`/finance/bank-transactions/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ siteId: siteId || null, manualOverride: true }),
      });
      const site = siteId ? sites.find((s) => s.id === siteId) : null;
      setTransactions((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, site: site ?? null } : x))
      );
    } catch {
      // ignore
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

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1600px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bank Transactions</h1>
        <Link href="/admin/finance/bank-upload" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          + Upload Statement
        </Link>
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

          {summary && (
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
              No transactions. Upload a bank statement or adjust filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === transactions.length && transactions.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Party Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 max-w-[160px]">Description</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Credit</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Project</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(t.transactionDate)}</td>
                      <td className="px-4 py-3 text-gray-700">{t.partyName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={t.description ?? undefined}>
                        {t.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 font-medium">
                        {t.type === 'EXPENSE' ? fmt(t.amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                        {t.type === 'INCOME' ? fmt(t.amount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.category?.id ?? ''}
                          onChange={(e) => handleCategoryChange(t, e.target.value || null)}
                          className="border rounded px-2 py-1 text-xs min-w-[100px]"
                        >
                          <option value="">—</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.site?.id ?? ''}
                          onChange={(e) => handleSiteChange(t, e.target.value || null)}
                          className="border rounded px-2 py-1 text-xs min-w-[100px]"
                        >
                          <option value="">—</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleEdit(t)}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {editingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Edit Transaction</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="INCOME">Received</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Party Name</label>
                <input
                  value={editForm.partyName ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, partyName: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Category</label>
                <select
                  value={editForm.category?.id ?? ''}
                  onChange={(e) => {
                    const c = categories.find((x) => x.id === e.target.value);
                    setEditForm((f) => ({ ...f, category: c ?? null }));
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <input
                  value={editForm.description ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
                Save
              </button>
              <button onClick={handleCancelEdit} className="px-4 py-2 rounded-lg border border-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
