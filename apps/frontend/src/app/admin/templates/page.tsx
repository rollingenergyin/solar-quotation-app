'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TemplateSummary {
  id: string;
  version: number;
  name: string;
  isActive: boolean;
  systemType: string;
  siteType: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  isDefaultTemplate?: boolean;
  createdBy: { name: string } | null;
}

const SYSTEM_TYPE_LABELS: Record<string, string> = { DCR: 'DCR', NON_DCR: 'Non-DCR', ANY: 'Any' };
const SITE_TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Residential', SOCIETY: 'Society', COMMERCIAL: 'Commercial', INDUSTRIAL: 'Industrial', ANY: 'Any',
};

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function TemplatesListPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [cloning, setCloning]     = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [error, setError]         = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const url = showDeleted ? `${API}/templates?includeDeleted=1` : `${API}/templates`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setTemplates(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [showDeleted]);

  const restoreTemplate = async (id: string, name: string) => {
    if (!confirm(`Restore template "${name}"?`)) return;
    setRestoring(id);
    try {
      const res = await fetch(`${API}/templates/${id}/restore`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || res.statusText);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally { setRestoring(null); }
  };

  const activate = async (id: string) => {
    setActivating(id);
    try {
      const res = await fetch(`${API}/templates/${id}/activate`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Activation failed');
    } finally { setActivating(null); }
  };

  const deactivate = async (id: string) => {
    setDeactivating(id);
    try {
      const res = await fetch(`${API}/templates/${id}/deactivate`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Deactivation failed');
    } finally { setDeactivating(null); }
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? You can restore it later from the deleted list.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/templates/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || res.statusText);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(null); }
  };

  const cloneTemplate = async (id: string, sourceName: string) => {
    const name = prompt(`Name for the new template version (cloning "${sourceName}"):`, `${sourceName} (Copy)`);
    if (!name) return;
    setCloning(id);
    try {
      const res = await fetch(`${API}/templates/${id}/clone`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Clone failed');
    } finally { setCloning(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotation Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage multiple templates. The system selects the matching template by <strong>System Type</strong> (DCR / Non-DCR)
            and <strong>Site Type</strong> (Residential / Society / Commercial / Industrial) when generating quotations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show deleted
          </label>
          <Link
            href="/admin/templates/new"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#6690cc' }}
          >
            + New Template
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button className="ml-3 text-red-400 hover:text-red-600" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No templates yet. Create one to get started.</div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Template Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">System Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Site Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {templates.filter((t) => !t.isDeleted).map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50/50"
                  style={{ backgroundColor: t.isActive ? '#f0f9ff' : undefined }}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.companyName} · {fmtDate(t.updatedAt)}
                        {t.createdBy && ` · by ${t.createdBy.name}`}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{SYSTEM_TYPE_LABELS[t.systemType] ?? t.systemType}</td>
                  <td className="px-4 py-3 text-gray-700">{SITE_TYPE_LABELS[t.siteType] ?? t.siteType}</td>
                  <td className="px-4 py-3">
                    {t.isActive ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-600">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.isActive ? (
                        <button
                          onClick={() => deactivate(t.id)}
                          disabled={deactivating === t.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                        >
                          {deactivating === t.id ? '…' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          onClick={() => activate(t.id)}
                          disabled={activating === t.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-green-50"
                          style={{ borderColor: '#16a34a', color: '#16a34a' }}
                        >
                          {activating === t.id ? 'Activating…' : 'Activate'}
                        </button>
                      )}
                      <button
                        onClick={() => cloneTemplate(t.id, t.name)}
                        disabled={cloning === t.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {cloning === t.id ? 'Cloning…' : 'Clone'}
                      </button>
                      <Link
                        href={`/admin/templates/${t.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#161c34' }}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteTemplate(t.id, t.name)}
                        disabled={deleting === t.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {deleting === t.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showDeleted && templates.some((t) => t.isDeleted) && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Deleted Templates</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">System / Site</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {templates.filter((t) => t.isDeleted).map((t) => (
                    <tr key={t.id} className="bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-700">{t.name}</p>
                        <p className="text-xs text-gray-400">{fmtDate(t.updatedAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {SYSTEM_TYPE_LABELS[t.systemType] ?? t.systemType} / {SITE_TYPE_LABELS[t.siteType] ?? t.siteType}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => restoreTemplate(t.id, t.name)}
                          disabled={restoring === t.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                        >
                          {restoring === t.id ? '…' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      )}

      {/* Info box */}
      <div className="mt-8 rounded-xl px-5 py-4 border border-blue-100 bg-blue-50 text-sm text-blue-800">
        <strong>How it works:</strong> Multiple templates can be active. The system picks the best match by
        <strong> System Type</strong> (DCR / Non-DCR) and <strong>Site Type</strong> (Residential / Society / Commercial / Industrial).
        Example: DCR + Residential → DCR Residential Template; Commercial (any system) → Commercial Template.
        Use <strong>Clone</strong> to duplicate a template and edit only the sections that differ.
      </div>
    </div>
  );
}
