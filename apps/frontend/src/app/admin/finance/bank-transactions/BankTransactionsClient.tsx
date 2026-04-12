'use client';

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import BankTransactionsTable, { type BankTx } from './BankTransactionsTable';
import AddTransactionModal from './AddTransactionModal';
import { downloadBankTransactionsExcel, downloadBankTransactionsPdf } from './exportBankTransactions';
import {
  ProjectSiteSelect,
  labelForSite,
  type FinanceProjectRow,
} from './projectSiteSelect';

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
  client?: { id: string; name: string } | null;
}

interface Summary {
  /** Category name → net (income − expense for that category) */
  byCategory: Record<string, number>;
  uncategorizedCount: number;
  uncategorizedNet: number;
  totalIncome: number;
  totalExpense: number;
  incomeByProject: Record<string, number>;
  expenseByProject: Record<string, number>;
  unassignedProjectIncome: number;
  unassignedProjectExpense: number;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

type NetBlock = {
  id: string;
  name: string;
  net: number;
  kind: 'uncat' | 'cat';
  uncategorizedCount?: number;
};

type ProjectAmountRow = {
  id: string;
  name: string;
  amount: number;
};

const netCardShell =
  'p-3 rounded-xl border text-left transition-shadow hover:shadow-md min-h-[92px] flex flex-col justify-between gap-1';

function netCardTone(net: number): string {
  if (net > 0) return 'bg-emerald-50 border-emerald-200/90 hover:bg-emerald-100/80';
  if (net < 0) return 'bg-rose-50 border-rose-200/90 hover:bg-rose-100/80';
  return 'bg-gray-50 border-gray-200/90 hover:bg-gray-100/80';
}

function netAmountClass(net: number): string {
  if (net > 0) return 'text-emerald-800';
  if (net < 0) return 'text-rose-800';
  return 'text-gray-700';
}

function netSubtitleClass(net: number): string {
  if (net > 0) return 'text-emerald-700/90';
  if (net < 0) return 'text-rose-700/90';
  return 'text-gray-500';
}

const projectSectionSummaryClass =
  'flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 [&::-webkit-details-marker]:hidden';

function ProjectSectionChevron() {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-transform group-open:rotate-180"
      aria-hidden
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

/** Collapsible section; all start closed (no default open). */
function ProjectDetailsPanel({
  summaryContent,
  children,
}: {
  summaryContent: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-gray-200 bg-white shadow-sm">
      <summary className={projectSectionSummaryClass}>
        {summaryContent}
        <ProjectSectionChevron />
      </summary>
      {children}
    </details>
  );
}

export default function BankTransactionsClient() {
  const searchParams = useSearchParams();
  const uploadIdFromUrl = searchParams.get('uploadId');
  const [uploads, setUploads] = useState<BankUpload[]>([]);
  const [sites, setSites] = useState<FinanceSite[]>([]);
  const [projects, setProjects] = useState<FinanceProjectRow[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUploadId, setSelectedUploadId] = useState<string>('');
  const [sortDate, setSortDate] = useState<'asc' | 'desc'>('asc');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [categoryFilterMode, setCategoryFilterMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [siteFilterMode, setSiteFilterMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());
  const [showSiteFilter, setShowSiteFilter] = useState(false);
  const [showEditProjects, setShowEditProjects] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingSiteName, setEditingSiteName] = useState('');
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
  const [showApplyProjectModal, setShowApplyProjectModal] = useState(false);
  const [applyProjectText, setApplyProjectText] = useState('');
  const [applyProjectToDate, setApplyProjectToDate] = useState('2026-03-13');
  const [applyProjectBusy, setApplyProjectBusy] = useState(false);
  const [applyProjectError, setApplyProjectError] = useState<string | null>(null);
  const [applyProjectResult, setApplyProjectResult] = useState<{
    rowCount: number;
    nonSplitTransactionLines: number;
    splitLineTargets: number;
    applied: number;
    cleared: number;
    unmatched: { index: number; label: string }[];
  } | null>(null);
  /** Shown when API calls fail (e.g. backend not running — browser may report Error -102) */
  const [listError, setListError] = useState<string | null>(null);
  /** Filter table to one FinanceSite (project) — used with type filter for project summary blocks */
  const [filterSiteId, setFilterSiteId] = useState<string>('');
  /** No project: only with type INCOME/EXPENSE — unassigned site income vs unassigned site expense (never "all types") */
  const [filterSiteUnassigned, setFilterSiteUnassigned] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'INV' | 'NO_INV' | 'unset'>('all');
  const [invoiceSort, setInvoiceSort] = useState<'default' | 'inv_first' | 'no_inv_first'>('default');
  const [billUploadFilter, setBillUploadFilter] = useState<
    'all' | 'UPLOADED' | 'NOT_UPLOADED' | 'unset'
  >('all');
  const [billUploadSort, setBillUploadSort] = useState<
    'default' | 'uploaded_first' | 'not_uploaded_first'
  >('default');

  const refreshTrashCount = useCallback(() => {
    if (!selectedUploadId) return;
    const p = new URLSearchParams({ uploadId: selectedUploadId, trash: 'true', limit: '1' });
    api<{ total: number }>(`/finance/bank-transactions?${p}`)
      .then((r) => setTrashCount(r.total))
      .catch(() => setTrashCount(0));
  }, [selectedUploadId]);

  const fetchTransactions = (opts?: { trash?: boolean }) => {
    if (!selectedUploadId) return;
    setLoading(true);
    setListError(null);
    const trashMode = opts?.trash !== undefined ? opts.trash : viewTrash;
    const params = new URLSearchParams({
      uploadId: selectedUploadId,
      limit: '500',
      sortDate,
    });
    if (trashMode) params.set('trash', 'true');
    if (filterSiteUnassigned && (typeFilter === 'INCOME' || typeFilter === 'EXPENSE')) {
      params.set('siteUnassigned', 'true');
      params.set('type', typeFilter);
    } else if (typeFilter !== 'ALL') {
      params.set('type', typeFilter);
    }
    if (uncategorizedOnly) params.set('uncategorized', 'true');
    else if (categoryFilterMode === 'include' && selectedCategoryIds.size > 0) {
      params.set('categories', Array.from(selectedCategoryIds).join(','));
    } else if (categoryFilterMode === 'exclude' && selectedCategoryIds.size > 0) {
      params.set('excludeCategories', Array.from(selectedCategoryIds).join(','));
    }     else if (filterCategory) params.set('category', filterCategory);
    if (siteFilterMode === 'include' && selectedSiteIds.size > 0) {
      params.set('sites', Array.from(selectedSiteIds).join(','));
    } else if (siteFilterMode === 'exclude' && selectedSiteIds.size > 0) {
      params.set('excludeSites', Array.from(selectedSiteIds).join(','));
    } else if (!filterSiteUnassigned && filterSiteId) {
      params.set('siteId', filterSiteId);
    }
    if (invoiceFilter !== 'all') params.set('invoiceStatus', invoiceFilter);
    if (invoiceSort !== 'default') params.set('invoiceSort', invoiceSort);
    if (billUploadFilter !== 'all') params.set('billUploadStatus', billUploadFilter);
    if (billUploadSort !== 'default') params.set('billUploadSort', billUploadSort);
    api<{ transactions: BankTransaction[]; total: number }>(`/finance/bank-transactions?${params}`)
      .then((r) => {
        setTransactions(r.transactions);
        setTotal(r.total);
        setListError(null);
      })
      .catch((e) => {
        setTransactions([]);
        setTotal(0);
        setListError(e instanceof Error ? e.message : 'Could not load transactions');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setListError(null);
    api<BankUpload[]>('/finance/bank-uploads')
      .then((u) => {
        setUploads(u);
        if (u.length > 0) {
          const validFromUrl = uploadIdFromUrl && u.some((x) => x.id === uploadIdFromUrl);
          setSelectedUploadId(validFromUrl ? uploadIdFromUrl! : u[0].id);
        } else {
          setSelectedUploadId('');
        }
        setListError(null);
      })
      .catch((e) => {
        setUploads([]);
        setSelectedUploadId('');
        setListError(e instanceof Error ? e.message : 'Could not load bank uploads');
      });
  }, [uploadIdFromUrl]);

  useEffect(() => {
    api<FinanceSite[]>('/finance/sites')
      .then(setSites)
      .catch(() => []);
  }, []);

  useEffect(() => {
    api<FinanceProjectRow[]>('/finance/projects')
      .then(setProjects)
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
  }, [
    selectedUploadId,
    sortDate,
    siteFilterMode,
    selectedSiteIds,
    typeFilter,
    uncategorizedOnly,
    filterCategory,
    categoryFilterMode,
    selectedCategoryIds,
    viewTrash,
    filterSiteId,
    filterSiteUnassigned,
    invoiceFilter,
    invoiceSort,
    billUploadFilter,
    billUploadSort,
  ]);

  useEffect(() => {
    setFilterSiteId('');
    setFilterSiteUnassigned(false);
  }, [selectedUploadId]);

  useEffect(() => {
    if (filterSiteUnassigned && typeFilter === 'ALL') setFilterSiteUnassigned(false);
  }, [filterSiteUnassigned, typeFilter]);

  useEffect(() => {
    refreshTrashCount();
  }, [refreshTrashCount]);

  useEffect(() => {
    if (!showCategoryFilter) return;
    const close = () => setShowCategoryFilter(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showCategoryFilter]);

  useEffect(() => {
    if (!showSiteFilter) return;
    const close = () => setShowSiteFilter(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSiteFilter]);

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

  const handleBulkInvoice = async (status: 'INV' | 'NO_INV') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkError(null);
    try {
      await api('/finance/bank-transactions/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, invoiceStatus: status }),
      });
      setSelectedIds(new Set());
      fetchTransactions();
      if (selectedUploadId) {
        const p = new URLSearchParams({ uploadId: selectedUploadId });
        api<Summary>(`/finance/bank-transactions/summary?${p}`).then(setSummary).catch(() => {});
      }
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Bulk update failed');
    }
  };

  const handleBulkBillUpload = async (status: 'UPLOADED' | 'NOT_UPLOADED') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkError(null);
    try {
      await api('/finance/bank-transactions/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, billUploadStatus: status }),
      });
      setSelectedIds(new Set());
      fetchTransactions();
      if (selectedUploadId) {
        const p = new URLSearchParams({ uploadId: selectedUploadId });
        api<Summary>(`/finance/bank-transactions/summary?${p}`).then(setSummary).catch(() => {});
      }
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Bulk update failed');
    }
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

  const handleStartEditSite = (s: FinanceSite) => {
    setEditingSiteId(s.id);
    setEditingSiteName(s.name);
  };

  const handleSaveEditSite = async () => {
    if (!editingSiteId || !editingSiteName.trim()) return;
    try {
      const updated = await api<FinanceSite>(`/finance/sites/${editingSiteId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editingSiteName.trim() }),
      });
      setSites((prev) =>
        prev.map((s) => (s.id === editingSiteId ? updated : s)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setTransactions((prev) =>
        prev.map((t) => ({
          ...t,
          site: t.site?.id === editingSiteId ? { ...t.site, name: updated.name } : t.site,
          splits: t.splits?.map((sp) =>
            sp.site?.id === editingSiteId
              ? { ...sp, site: sp.site ? { ...sp.site, name: updated.name } : null }
              : sp
          ),
        }))
      );
      setEditingSiteId(null);
      setEditingSiteName('');
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Could not update project');
    }
  };

  const handleCancelEditSite = () => {
    setEditingSiteId(null);
    setEditingSiteName('');
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

  const selectedCategoryIdsList = useMemo(
    () => [...selectedCategoryIds].sort(),
    [selectedCategoryIds]
  );

  const netBlocksGrouped = useMemo(() => {
    if (!summary) return { positive: [] as NetBlock[], negative: [] as NetBlock[], zero: [] as NetBlock[] };
    const uNet = summary.uncategorizedNet ?? 0;
    const list: NetBlock[] = [
      {
        id: '__uncat',
        name: 'Uncategorized',
        net: uNet,
        kind: 'uncat',
        uncategorizedCount: summary.uncategorizedCount,
      },
      ...categories.map((c) => ({
        id: c.id,
        name: c.name,
        net: summary.byCategory[c.name] ?? 0,
        kind: 'cat' as const,
      })),
    ];
    const positive = list.filter((x) => x.net > 0).sort((a, b) => b.net - a.net);
    const negative = list.filter((x) => x.net < 0).sort((a, b) => a.net - b.net);
    const zero = list.filter((x) => x.net === 0).sort((a, b) => a.name.localeCompare(b.name));
    return { positive, negative, zero };
  }, [summary, categories]);

  /** Named projects only — unassigned site income/expense are a separate 2-card section */
  const projectIncomeRows = useMemo((): ProjectAmountRow[] => {
    if (!summary) return [];
    const inc = summary.incomeByProject ?? {};
    const rows: ProjectAmountRow[] = sites.map((s) => ({
      id: s.id,
      name: s.name,
      amount: inc[s.name] ?? 0,
    }));
    const nz = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
    const z = rows.filter((r) => r.amount === 0).sort((a, b) => a.name.localeCompare(b.name));
    return [...nz, ...z];
  }, [summary, sites]);

  const projectExpenseRows = useMemo((): ProjectAmountRow[] => {
    if (!summary) return [];
    const exp = summary.expenseByProject ?? {};
    const rows: ProjectAmountRow[] = sites.map((s) => ({
      id: s.id,
      name: s.name,
      amount: exp[s.name] ?? 0,
    }));
    const nz = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
    const z = rows.filter((r) => r.amount === 0).sort((a, b) => a.name.localeCompare(b.name));
    return [...nz, ...z];
  }, [summary, sites]);

  const exportBaseFilename = () => {
    const raw = uploads.find((u) => u.id === selectedUploadId)?.fileName ?? 'bank-transactions';
    const base = raw.replace(/\.[^.]+$/, '');
    return `${base}-transactions-${new Date().toISOString().slice(0, 10)}`;
  };

  const handleExportExcel = () => {
    downloadBankTransactionsExcel(transactions, exportBaseFilename(), sites, projects);
  };

  const handleExportPdf = async () => {
    setExportBusy(true);
    try {
      await downloadBankTransactionsPdf(transactions, exportBaseFilename(), sites, projects);
    } finally {
      setExportBusy(false);
    }
  };

  const handleApplyProjectLabels = async () => {
    if (!selectedUploadId) return;
    const lines = applyProjectText.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1]?.trim() === '') lines.pop();
    const names = lines.map((l) => l.trim());
    if (names.length === 0) {
      setApplyProjectError('Paste at least one line.');
      setApplyProjectResult(null);
      return;
    }
    setApplyProjectBusy(true);
    setApplyProjectError(null);
    setApplyProjectResult(null);
    try {
      const out = await api<{
        rowCount: number;
        nameCount: number;
        nonSplitTransactionLines: number;
        splitLineTargets: number;
        applied: number;
        cleared: number;
        unmatched: { index: number; label: string }[];
      }>('/finance/bank-transactions/apply-project-labels', {
        method: 'POST',
        body: JSON.stringify({
          uploadId: selectedUploadId,
          toDate: applyProjectToDate,
          names,
        }),
      });
      setApplyProjectResult({
        rowCount: out.rowCount,
        nonSplitTransactionLines: out.nonSplitTransactionLines,
        splitLineTargets: out.splitLineTargets,
        applied: out.applied,
        cleared: out.cleared,
        unmatched: out.unmatched,
      });
      fetchTransactions();
      refreshSummary();
    } catch (e) {
      setApplyProjectError(e instanceof Error ? e.message : 'Failed to apply');
    } finally {
      setApplyProjectBusy(false);
    }
  };

  const openNetBlockFilter = (item: NetBlock) => {
    setFilterSiteId('');
    setFilterSiteUnassigned(false);
    setSiteFilterMode('all');
    setSelectedSiteIds(new Set());
    if (item.kind === 'uncat') {
      setUncategorizedOnly(true);
      setFilterCategory('');
      setCategoryFilterMode('all');
      setSelectedCategoryIds(new Set());
    } else {
      setUncategorizedOnly(false);
      setFilterCategory('');
      setCategoryFilterMode('include');
      setSelectedCategoryIds(new Set([item.id]));
    }
  };

  const openProjectFilter = (siteId: string, which: 'INCOME' | 'EXPENSE') => {
    setFilterSiteUnassigned(false);
    setFilterSiteId(siteId);
    setTypeFilter(which);
    setUncategorizedOnly(false);
    setFilterCategory('');
    setCategoryFilterMode('all');
    setSelectedCategoryIds(new Set());
    setSiteFilterMode('all');
    setSelectedSiteIds(new Set());
  };

  const openUnassignedProjectFilter = (which: 'INCOME' | 'EXPENSE') => {
    setFilterSiteId('');
    setFilterSiteUnassigned(true);
    setTypeFilter(which);
    setUncategorizedOnly(false);
    setFilterCategory('');
    setCategoryFilterMode('all');
    setSelectedCategoryIds(new Set());
    setSiteFilterMode('all');
    setSelectedSiteIds(new Set());
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1600px]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Bank Transactions</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowApplyProjectModal(true);
              setApplyProjectError(null);
              setApplyProjectResult(null);
            }}
            disabled={uploads.length === 0 || viewTrash || !selectedUploadId}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Paste an ordered project column; matches existing sites/projects only"
          >
            Apply project column
          </button>
          <button
            type="button"
            onClick={() => setShowAddTransaction(true)}
            disabled={uploads.length === 0}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add transaction
          </button>
          <Link href="/admin/finance/bank-upload" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
            + Upload Statement
          </Link>
        </div>
      </div>

      {listError && (
        <div
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-medium">Could not reach the finance API</p>
          <p className="mt-1 text-amber-900/95">{listError}</p>
        </div>
      )}

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
                    onClick={() => {
                      if (t === 'ALL') setFilterSiteUnassigned(false);
                      setTypeFilter(t);
                    }}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
            <select
              value={invoiceFilter}
              onChange={(e) => setInvoiceFilter(e.target.value as typeof invoiceFilter)}
              className="border rounded-lg px-3 py-2 text-sm min-w-[130px]"
            >
              <option value="all">All</option>
              <option value="INV">INV only</option>
              <option value="NO_INV">NO INV only</option>
              <option value="unset">Untagged</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort by invoice</label>
            <select
              value={invoiceSort}
              onChange={(e) => setInvoiceSort(e.target.value as typeof invoiceSort)}
              className="border rounded-lg px-3 py-2 text-sm min-w-[150px]"
            >
              <option value="default">Default</option>
              <option value="inv_first">INV first</option>
              <option value="no_inv_first">NO INV first</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill upload</label>
            <select
              value={billUploadFilter}
              onChange={(e) => setBillUploadFilter(e.target.value as typeof billUploadFilter)}
              className="border rounded-lg px-3 py-2 text-sm min-w-[130px]"
            >
              <option value="all">All</option>
              <option value="UPLOADED">UP only</option>
              <option value="NOT_UPLOADED">NO UP only</option>
              <option value="unset">Untagged</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort by upload</label>
            <select
              value={billUploadSort}
              onChange={(e) => setBillUploadSort(e.target.value as typeof billUploadSort)}
              className="border rounded-lg px-3 py-2 text-sm min-w-[150px]"
            >
              <option value="default">Default</option>
              <option value="uploaded_first">UP first</option>
              <option value="not_uploaded_first">NO UP first</option>
            </select>
          </div>
          {(filterSiteId || filterSiteUnassigned || siteFilterMode !== 'all' || selectedSiteIds.size > 0) && (
            <button
              type="button"
              onClick={() => {
                setFilterSiteId('');
                setFilterSiteUnassigned(false);
                setSiteFilterMode('all');
                setSelectedSiteIds(new Set());
              }}
              className="px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 text-sm font-medium hover:bg-violet-100"
            >
              Clear project filter
            </button>
          )}
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
                    setSiteFilterMode('all');
                    setSelectedSiteIds(new Set());
                  }
                }}
              />
              <span className="text-sm text-gray-700">Uncategorized only</span>
            </label>
            {!uncategorizedOnly && (
              <div className="flex items-end gap-1 relative">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by category
                    {viewTrash ? (
                      <span className="ml-1 font-normal text-amber-800">(recycle bin)</span>
                    ) : null}
                  </label>
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
            {!uncategorizedOnly && (
              <div className="flex items-end gap-1 relative">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by project
                    {viewTrash ? (
                      <span className="ml-1 font-normal text-amber-800">(recycle bin)</span>
                    ) : null}
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSiteFilter(!showSiteFilter);
                    }}
                    className="border rounded-lg px-3 py-2 text-sm text-left min-w-[180px] flex items-center justify-between gap-2 bg-white"
                  >
                    <span>
                      {siteFilterMode === 'all'
                        ? 'All projects'
                        : siteFilterMode === 'include'
                          ? `Show ${selectedSiteIds.size} selected`
                          : `Hide ${selectedSiteIds.size} selected`}
                    </span>
                    <span className="text-gray-400">{showSiteFilter ? '▲' : '▼'}</span>
                  </button>
                  {showSiteFilter && (
                    <div
                      className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-lg py-2 min-w-[220px] max-h-64 overflow-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 border-b space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={siteFilterMode === 'all'}
                            onChange={() => {
                              setSiteFilterMode('all');
                              setSelectedSiteIds(new Set());
                            }}
                          />
                          <span className="text-xs">All projects</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={siteFilterMode === 'include'}
                            onChange={() => {
                              setSiteFilterMode('include');
                              setFilterSiteId('');
                              setFilterSiteUnassigned(false);
                            }}
                          />
                          <span className="text-xs">Show only selected</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={siteFilterMode === 'exclude'}
                            onChange={() => {
                              setSiteFilterMode('exclude');
                              setFilterSiteId('');
                              setFilterSiteUnassigned(false);
                            }}
                          />
                          <span className="text-xs">Hide selected</span>
                        </label>
                      </div>
                      <div className="px-3 py-2 max-h-40 overflow-auto">
                        {sites.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 py-1 px-2 rounded">
                            <input
                              type="checkbox"
                              checked={selectedSiteIds.has(s.id)}
                              onChange={(e) => {
                                setFilterSiteId('');
                                setFilterSiteUnassigned(false);
                                setSelectedSiteIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(s.id);
                                  else next.delete(s.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm">{labelForSite(s)}</span>
                          </label>
                        ))}
                      </div>
                      {(siteFilterMode === 'include' || siteFilterMode === 'exclude') && selectedSiteIds.size > 0 && (
                        <div className="px-3 py-2 border-t">
                          <button
                            type="button"
                            onClick={() => setSelectedSiteIds(new Set())}
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
                  onClick={() => setShowNewSite(true)}
                  className="px-2 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm"
                  title="New Project"
                >
                  + Project
                </button>
                <button
                  onClick={() => setShowEditProjects(true)}
                  className="px-2 py-2 rounded-lg border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 text-sm"
                  title="Edit Projects"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {summary && !viewTrash && (
            <div className="mb-6 space-y-5">
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-stretch">
                <div className="flex-1 min-w-[160px] rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Received (all)</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{fmt(summary.totalIncome)}</div>
                  <div className="mt-1 text-[11px] text-emerald-700/80">Total credits in scope</div>
                </div>
                <div className="flex-1 min-w-[160px] rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Expense (all)</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-rose-900">{fmt(summary.totalExpense)}</div>
                  <div className="mt-1 text-[11px] text-rose-700/80">Total debits in scope</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-600">
                <span className="font-medium text-gray-700">Net by category</span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  Positive
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
                  Negative
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-400" />
                  Zero
                </span>
              </div>

              <div className="space-y-5">
                {netBlocksGrouped.positive.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 border-b border-emerald-100 pb-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Net positive ({netBlocksGrouped.positive.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {netBlocksGrouped.positive.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openNetBlockFilter(item)}
                          className={`${netCardShell} ${netCardTone(item.net)}`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-800 truncate">
                              {item.name.replace(/_/g, ' ')}
                            </div>
                            {item.kind === 'uncat' && (
                              <div className="text-[11px] text-gray-600">{item.uncategorizedCount ?? 0} txns</div>
                            )}
                            <div className={`text-[10px] font-medium uppercase tracking-wide ${netSubtitleClass(item.net)}`}>
                              Net
                            </div>
                          </div>
                          <div className={`text-lg font-bold tabular-nums ${netAmountClass(item.net)}`}>
                            {fmt(item.net)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {netBlocksGrouped.negative.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 border-b border-rose-100 pb-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-rose-800">
                        Net negative ({netBlocksGrouped.negative.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {netBlocksGrouped.negative.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openNetBlockFilter(item)}
                          className={`${netCardShell} ${netCardTone(item.net)}`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-800 truncate">
                              {item.name.replace(/_/g, ' ')}
                            </div>
                            {item.kind === 'uncat' && (
                              <div className="text-[11px] text-gray-600">{item.uncategorizedCount ?? 0} txns</div>
                            )}
                            <div className={`text-[10px] font-medium uppercase tracking-wide ${netSubtitleClass(item.net)}`}>
                              Net
                            </div>
                          </div>
                          <div className={`text-lg font-bold tabular-nums ${netAmountClass(item.net)}`}>
                            {fmt(item.net)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {netBlocksGrouped.zero.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 border-b border-gray-200 pb-2">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        Balanced (zero net) ({netBlocksGrouped.zero.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {netBlocksGrouped.zero.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openNetBlockFilter(item)}
                          className={`${netCardShell} ${netCardTone(item.net)}`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-800 truncate">
                              {item.name.replace(/_/g, ' ')}
                            </div>
                            {item.kind === 'uncat' && (
                              <div className="text-[11px] text-gray-600">{item.uncategorizedCount ?? 0} txns</div>
                            )}
                            <div className={`text-[10px] font-medium uppercase tracking-wide ${netSubtitleClass(item.net)}`}>
                              Net
                            </div>
                          </div>
                          <div className={`text-lg font-bold tabular-nums ${netAmountClass(item.net)}`}>{fmt(item.net)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 mt-2 border-t border-gray-200">
                  <ProjectDetailsPanel
                    key={`${selectedUploadId}-unassigned`}
                    summaryContent={
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        Unassigned project
                      </span>
                    }
                  >
                    <div className="border-t border-gray-100 px-3 pb-3 pt-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-2xl">
                        <button
                          type="button"
                          onClick={() => openUnassignedProjectFilter('INCOME')}
                          className={`${netCardShell} border border-dashed border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/90`}
                          title="List only unassigned site income (received, no project)"
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-800">Unassigned site income</div>
                          </div>
                          <div className="text-lg font-bold tabular-nums text-emerald-900">
                            {fmt(summary.unassignedProjectIncome ?? 0)}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => openUnassignedProjectFilter('EXPENSE')}
                          className={`${netCardShell} border border-dashed border-rose-200 bg-rose-50/80 hover:bg-rose-100/90`}
                          title="List only unassigned site expense (no project)"
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-800">Unassigned site expense</div>
                          </div>
                          <div className="text-lg font-bold tabular-nums text-rose-900">
                            {fmt(summary.unassignedProjectExpense ?? 0)}
                          </div>
                        </button>
                      </div>
                    </div>
                  </ProjectDetailsPanel>

                  {(projectIncomeRows.length > 0 || projectExpenseRows.length > 0) && (
                    <ProjectDetailsPanel
                      key={`${selectedUploadId}-assigned`}
                      summaryContent={
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                          Assigned project
                        </span>
                      }
                    >
                      <div className="space-y-3 border-t border-gray-100 px-3 pb-3 pt-3">
                        {projectIncomeRows.length > 0 && (
                          <ProjectDetailsPanel
                            key={`${selectedUploadId}-income`}
                            summaryContent={
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                  Income by project ({projectIncomeRows.length})
                                </span>
                              </span>
                            }
                          >
                            <div className="border-t border-gray-100 px-0 pb-0 pt-3 sm:pl-2">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {projectIncomeRows.map((row) => (
                                  <button
                                    type="button"
                                    key={`pi-${row.id}`}
                                    onClick={() => openProjectFilter(row.id, 'INCOME')}
                                    className={`${netCardShell} ${
                                      row.amount > 0
                                        ? 'bg-emerald-50 border-emerald-200/90 hover:bg-emerald-100/80'
                                        : 'bg-gray-50 border-gray-200/90 hover:bg-gray-100/80'
                                    }`}
                                  >
                                    <div>
                                      <div className="text-xs font-semibold text-gray-800 truncate">{row.name}</div>
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/90">
                                        Income
                                      </div>
                                    </div>
                                    <div
                                      className={`text-lg font-bold tabular-nums ${
                                        row.amount > 0 ? 'text-emerald-900' : 'text-gray-600'
                                      }`}
                                    >
                                      {fmt(row.amount)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </ProjectDetailsPanel>
                        )}

                        {projectExpenseRows.length > 0 && (
                          <ProjectDetailsPanel
                            key={`${selectedUploadId}-expense`}
                            summaryContent={
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-rose-800">
                                  Expense by project ({projectExpenseRows.length})
                                </span>
                              </span>
                            }
                          >
                            <div className="border-t border-gray-100 px-0 pb-0 pt-3 sm:pl-2">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {projectExpenseRows.map((row) => (
                                  <button
                                    type="button"
                                    key={`pe-${row.id}`}
                                    onClick={() => openProjectFilter(row.id, 'EXPENSE')}
                                    className={`${netCardShell} ${
                                      row.amount > 0
                                        ? 'bg-rose-50 border-rose-200/90 hover:bg-rose-100/80'
                                        : 'bg-gray-50 border-gray-200/90 hover:bg-gray-100/80'
                                    }`}
                                  >
                                    <div>
                                      <div className="text-xs font-semibold text-gray-800 truncate">{row.name}</div>
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-rose-700/90">
                                        Expense
                                      </div>
                                    </div>
                                    <div
                                      className={`text-lg font-bold tabular-nums ${
                                        row.amount > 0 ? 'text-rose-900' : 'text-gray-600'
                                      }`}
                                    >
                                      {fmt(row.amount)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </ProjectDetailsPanel>
                        )}
                      </div>
                    </ProjectDetailsPanel>
                  )}
                </div>
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
              <>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm"
                  aria-label="Bulk category"
                >
                  <option value="">Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <ProjectSiteSelect
                    sites={sites}
                    projects={projects}
                    valueSiteId={bulkSiteId || null}
                    onPickSiteId={(sid) => setBulkSiteId(sid ?? '')}
                  />
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
                {!viewTrash && (
                  <button
                    onClick={() => handleBulkAssign('isReviewed')}
                    className="px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium"
                  >
                    Mark as reviewed
                  </button>
                )}
                {!viewTrash && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBulkInvoice('INV')}
                      className="px-3 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-medium hover:bg-emerald-100"
                    >
                      Mark as INV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkInvoice('NO_INV')}
                      className="px-3 py-1.5 rounded border border-rose-300 bg-rose-50 text-rose-900 text-sm font-medium hover:bg-rose-100"
                    >
                      Mark as NO INV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkBillUpload('UPLOADED')}
                      className="px-3 py-1.5 rounded border border-sky-300 bg-sky-50 text-sky-900 text-sm font-medium hover:bg-sky-100"
                    >
                      Mark uploaded
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkBillUpload('NOT_UPLOADED')}
                      className="px-3 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium hover:bg-amber-100"
                    >
                      Mark not uploaded
                    </button>
                  </>
                )}
              </>
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
                projects={projects}
                onTotalsRefresh={refreshSummary}
                onTransactionsRefresh={fetchTransactions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                disableDrag={viewTrash}
                categoryFilterMode={categoryFilterMode}
                selectedCategoryIdsList={selectedCategoryIdsList}
                filterCategory={filterCategory}
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

      {showEditProjects && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditProjects(false);
            handleCancelEditSite();
          }}
        >
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Edit Projects</h3>
            <ul className="space-y-2 mb-4">
              {sites.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  {editingSiteId === s.id ? (
                    <>
                      <input
                        value={editingSiteName}
                        onChange={(e) => setEditingSiteName(e.target.value)}
                        className="flex-1 border rounded px-3 py-1.5 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEditSite()}
                        autoFocus
                      />
                      <button type="button" onClick={handleSaveEditSite} className="px-2 py-1 text-green-600 text-sm font-medium">
                        Save
                      </button>
                      <button type="button" onClick={handleCancelEditSite} className="px-2 py-1 text-gray-500 text-sm">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-gray-800">{s.name}</span>
                      <button
                        type="button"
                        onClick={() => handleStartEditSite(s)}
                        className="px-2 py-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setShowEditProjects(false);
                handleCancelEditSite();
              }}
              className="px-4 py-2 rounded-lg border border-gray-300"
            >
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

      {showApplyProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-200"
            role="dialog"
            aria-labelledby="apply-project-title"
          >
            <h2 id="apply-project-title" className="text-lg font-semibold text-gray-900">
              Apply project column (paste)
            </h2>
            <div className="mt-2 space-y-3 text-sm text-gray-600">
              <p>
                Same ordering as the server: <strong>oldest first</strong>, all types, all invoice/bill filters, through
                the end date (inclusive). Each pasted line must match an existing site or project label (nothing new is
                created). Use <strong>—</strong> or leave blank for unassigned.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-amber-950">
                <p className="font-semibold text-amber-950">Split transactions (important)</p>
                <ul className="mt-1.5 list-disc pl-5 space-y-1">
                  <li>
                    The <strong>main row</strong> of a split (the one with date/party) has no project field — do{' '}
                    <strong>not</strong> paste a line for it.
                  </li>
                  <li>
                    Paste <strong>only one line per split sub-row</strong> (the indented lines under that transaction),
                    in the same order as those lines appear.
                  </li>
                  <li>
                    A normal (non-split) row still uses <strong>one</strong> pasted line for its project cell.
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Through date (inclusive)</label>
              <input
                type="date"
                value={applyProjectToDate}
                onChange={(e) => setApplyProjectToDate(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">One label per line</label>
              <textarea
                value={applyProjectText}
                onChange={(e) => setApplyProjectText(e.target.value)}
                rows={12}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="Paste column here…"
              />
            </div>
            {applyProjectError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {applyProjectError}
              </p>
            )}
            {applyProjectResult && (
              <div className="mt-3 text-sm text-gray-700 rounded-lg bg-gray-50 px-3 py-2">
                <p>
                  Updated: {applyProjectResult.applied} with project, cleared: {applyProjectResult.cleared}. Targets:{' '}
                  {applyProjectResult.rowCount} total ({applyProjectResult.nonSplitTransactionLines} non-split rows +{' '}
                  {applyProjectResult.splitLineTargets} split lines; parent rows of splits are not counted).
                </p>
                {applyProjectResult.unmatched.length > 0 && (
                  <p className="mt-2 text-amber-800">
                    Unmatched labels (left unchanged):{' '}
                    {applyProjectResult.unmatched
                      .slice(0, 15)
                      .map((u) => `#${u.index + 1} “${u.label}”`)
                      .join('; ')}
                    {applyProjectResult.unmatched.length > 15 ? ' …' : ''}
                  </p>
                )}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowApplyProjectModal(false);
                  setApplyProjectError(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleApplyProjectLabels}
                disabled={applyProjectBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {applyProjectBusy ? 'Applying…' : 'Apply'}
              </button>
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
        projects={projects}
        selectedUploadId={selectedUploadId}
        sortDate={sortDate}
        onCreated={() => {
          setViewTrash(false);
          fetchTransactions({ trash: false });
          refreshSummary();
          refreshTrashCount();
        }}
      />
    </div>
  );
}
