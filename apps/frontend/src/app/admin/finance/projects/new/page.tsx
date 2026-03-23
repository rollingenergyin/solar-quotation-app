'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface FinanceClient {
  id: string;
  name: string;
}

interface FinanceSite {
  id: string;
  name: string;
  client?: FinanceClient;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [sites, setSites] = useState<FinanceSite[]>([]);
  const [form, setForm] = useState({
    clientId: '',
    siteId: '',
    code: '',
    status: 'ACTIVE',
  });
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewSite, setShowNewSite] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [siteError, setSiteError] = useState('');

  useEffect(() => {
    api<FinanceClient[]>('/finance/clients')
      .then(setClients)
      .catch(() => []);
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setSites([]);
      setForm((f) => ({ ...f, siteId: '' }));
      return;
    }
    api<FinanceSite[]>(`/finance/sites?clientId=${form.clientId}`)
      .then(setSites)
      .catch(() => []);
    setForm((f) => ({ ...f, siteId: '' }));
  }, [form.clientId]);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const client = await api<FinanceClient>('/finance/clients', {
        method: 'POST',
        body: JSON.stringify({ name: newClientName.trim() }),
      });
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, clientId: client.id }));
      setNewClientName('');
      setShowNewClient(false);
    } catch {
      // ignore
    }
  };

  const handleCreateSite = async () => {
    if (!newSiteName.trim() || !form.clientId) return;
    setSiteError('');
    try {
      const site = await api<FinanceSite>('/finance/sites', {
        method: 'POST',
        body: JSON.stringify({ name: newSiteName.trim(), clientId: form.clientId }),
      });
      setSites((prev) => [...prev, site].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, siteId: site.id }));
      setNewSiteName('');
      setShowNewSite(false);
    } catch (e) {
      setSiteError(e instanceof Error ? e.message : 'Failed to create project');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const siteName = sites.find((s) => s.id === form.siteId)?.name ?? 'Project';
      await api('/finance/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: siteName,
          code: form.code || undefined,
          financeSiteId: form.siteId || undefined,
          status: form.status,
        }),
      });
      router.push('/admin/finance/projects');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href="/admin/finance/projects" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Projects</Link>
      <h1 className="text-xl font-bold mb-6">Add Project</h1>
      <p className="text-sm text-gray-600 mb-6">First select or create a <strong>Client</strong>, then create/select a <strong>Project</strong> under that client.</p>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
          <div className="flex gap-2">
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="flex-1 border rounded-lg px-3 py-2"
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewClient(true)}
              className="px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 text-sm font-medium"
            >
              + New
            </button>
          </div>
          {showNewClient && (
            <div className="mt-2 flex gap-2">
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={handleCreateClient} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Add</button>
              <button type="button" onClick={() => { setShowNewClient(false); setNewClientName(''); }} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Project *</label>
          <div className="flex gap-2">
            <select
              required
              value={form.siteId}
              onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
              className="flex-1 border rounded-lg px-3 py-2"
              disabled={!form.clientId}
            >
              <option value="">Select project…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setShowNewSite(true); setSiteError(''); }}
              disabled={!form.clientId}
              title={!form.clientId ? 'Select a client first' : 'Add new project'}
              className="px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + New
            </button>
          </div>
          {showNewSite && form.clientId && (
            <div className="mt-2 space-y-2">
              {siteError && <p className="text-sm text-red-600">{siteError}</p>}
              <div className="flex gap-2">
                <input
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateSite())}
                  placeholder="Project name"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  autoFocus
                />
                <button type="button" onClick={handleCreateSite} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Add</button>
                <button type="button" onClick={() => { setShowNewSite(false); setNewSiteName(''); setSiteError(''); }} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. PRJ-001" />
        </div>
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
