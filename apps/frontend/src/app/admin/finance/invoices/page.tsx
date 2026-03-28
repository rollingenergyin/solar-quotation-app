'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

function downloadPdf(id: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  fetch(`/api/finance/invoices/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id.slice(-8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => {});
}

interface Invoice {
  id: string;
  mainKind: string;
  subtype: string;
  totalAmount: number;
  createdAt: string;
  items?: unknown;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  deletedAt?: string | null;
  client: { name: string };
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function mainKindLabel(k: string): string {
  const m: Record<string, string> = {
    TAX_INVOICE: 'Tax',
    PROFORMA_INVOICE: 'Proforma',
    QUOTATION: 'Quotation',
    EWAY_BILL: 'E-Way',
  };
  return m[k] ?? k;
}

function convertTargets(mainKind: string): { value: string; label: string }[] {
  switch (mainKind) {
    case 'QUOTATION':
      return [
        { value: 'PROFORMA_INVOICE', label: 'To proforma' },
        { value: 'TAX_INVOICE', label: 'To tax invoice' },
      ];
    case 'PROFORMA_INVOICE':
      return [{ value: 'TAX_INVOICE', label: 'To tax invoice' }];
    case 'TAX_INVOICE':
      return [{ value: 'EWAY_BILL', label: 'To E-Way bill' }];
    default:
      return [];
  }
}

function documentMetaFromItems(items: unknown): { invoiceNumber?: string; invoiceDate?: string } {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return {};
  const o = items as { documentMeta?: { invoiceNumber?: string; invoiceDate?: string } };
  return o.documentMeta && typeof o.documentMeta === 'object' ? o.documentMeta : {};
}

type ViewMode = 'active' | 'trash';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainKindFilter, setMainKindFilter] = useState<string>('');
  const [subtypeFilter, setSubtypeFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const params = new URLSearchParams();
    if (viewMode === 'trash') params.set('trashed', '1');
    if (mainKindFilter) params.set('mainKind', mainKindFilter);
    if (subtypeFilter) params.set('subtype', subtypeFilter);
    const path = `/finance/invoices${params.toString() ? `?${params.toString()}` : ''}`;
    setLoading(true);
    api<Invoice[]>(path)
      .then(setInvoices)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load invoices');
        setInvoices([]);
      })
      .finally(() => setLoading(false));
  }, [mainKindFilter, subtypeFilter, viewMode]);

  const moveToTrash = async (id: string) => {
    if (!window.confirm('Move this invoice to the recycle bin? You can restore it later.')) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/finance/invoices/${id}`, { method: 'DELETE' });
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api<Invoice>(`/finance/invoices/${id}/restore`, { method: 'POST' });
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore');
    } finally {
      setBusyId(null);
    }
  };

  const convertTo = async (id: string, targetMainKind: string) => {
    if (!window.confirm(`Create a new document converted to ${targetMainKind.replace(/_/g, ' ')}?`)) return;
    setBusyId(id);
    setError(null);
    try {
      await api<{ id: string }>(`/finance/invoices/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ targetMainKind }),
      });
      const params = new URLSearchParams();
      if (viewMode === 'trash') params.set('trashed', '1');
      if (mainKindFilter) params.set('mainKind', mainKindFilter);
      if (subtypeFilter) params.set('subtype', subtypeFilter);
      const path = `/finance/invoices${params.toString() ? `?${params.toString()}` : ''}`;
      const list = await api<Invoice[]>(path);
      setInvoices(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert');
    } finally {
      setBusyId(null);
    }
  };

  const purge = async (id: string) => {
    if (
      !window.confirm(
        'Permanently delete this invoice? This cannot be undone.'
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await api(`/finance/invoices/${id}/permanent`, { method: 'DELETE' });
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setViewMode('active')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                viewMode === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All invoices
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trash')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                viewMode === 'trash' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Recycle bin
            </button>
          </div>
          <select
            value={mainKindFilter}
            onChange={(e) => setMainKindFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All document kinds</option>
            <option value="TAX_INVOICE">Tax invoice</option>
            <option value="PROFORMA_INVOICE">Proforma</option>
            <option value="QUOTATION">Quotation</option>
            <option value="EWAY_BILL">E-Way bill</option>
          </select>
          <select
            value={subtypeFilter}
            onChange={(e) => setSubtypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All subtypes</option>
            <option value="SPGS">SPGS</option>
            <option value="SERVICE">Service</option>
            <option value="PRODUCT">Product</option>
          </select>
          {viewMode === 'active' && (
            <Link
              href="/admin/finance/invoices/new"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
            >
              + New Invoice
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {viewMode === 'trash' ? 'Recycle bin is empty.' : 'No invoices yet.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-20">No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Kind</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Subtype</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                  {viewMode === 'trash' && (
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Removed</th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((i) => {
                  const dm = documentMetaFromItems(i.items);
                  const no = i.invoiceNumber?.trim() || dm.invoiceNumber?.trim() || '—';
                  const docDate = i.invoiceDate
                    ? fmtDate(i.invoiceDate)
                    : dm.invoiceDate
                      ? fmtDate(`${dm.invoiceDate}T12:00:00`)
                      : fmtDate(i.createdAt);
                  const removedAt = i.deletedAt ? fmtDate(i.deletedAt) : '—';
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800 font-medium tabular-nums">{no}</td>
                      <td className="px-4 py-3 text-gray-600">{docDate}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{mainKindLabel(i.mainKind)}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{i.subtype}</td>
                      <td className="px-4 py-3 text-gray-600">{i.client?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(i.totalAmount)}</td>
                      {viewMode === 'trash' && (
                        <td className="px-4 py-3 text-gray-500 text-xs">{removedAt}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <button
                            type="button"
                            onClick={() => downloadPdf(i.id)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            PDF
                          </button>
                          {viewMode === 'active' &&
                            convertTargets(i.mainKind).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={busyId === i.id}
                                onClick={() => void convertTo(i.id, opt.value)}
                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium disabled:opacity-50"
                              >
                                {busyId === i.id ? '…' : opt.label}
                              </button>
                            ))}
                          {viewMode === 'active' ? (
                            <button
                              type="button"
                              disabled={busyId === i.id}
                              onClick={() => void moveToTrash(i.id)}
                              className="text-rose-600 hover:text-rose-700 text-sm font-medium disabled:opacity-50"
                            >
                              {busyId === i.id ? '…' : 'Delete'}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busyId === i.id}
                                onClick={() => void restore(i.id)}
                                className="text-emerald-700 hover:text-emerald-800 text-sm font-medium disabled:opacity-50"
                              >
                                {busyId === i.id ? '…' : 'Restore'}
                              </button>
                              <button
                                type="button"
                                disabled={busyId === i.id}
                                onClick={() => void purge(i.id)}
                                className="text-gray-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                              >
                                Delete forever
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
