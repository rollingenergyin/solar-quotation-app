'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  stage: string;
  score: number;
  source: string;
  language: string;
  systemKw: number | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  _count: { events: number; conversations: number };
};

type LeadsResponse = { leads: Lead[]; total: number; page: number; pages: number };

const STAGE_COLOR: Record<string, string> = {
  NEW:                    'bg-gray-100 text-gray-700',
  CONTACTED:              'bg-blue-100 text-blue-700',
  QUALIFIED:              'bg-indigo-100 text-indigo-700',
  SITE_VISIT_SCHEDULED:   'bg-yellow-100 text-yellow-800',
  SITE_VISIT_DONE:        'bg-orange-100 text-orange-700',
  PROPOSAL_SENT:          'bg-purple-100 text-purple-700',
  NEGOTIATION:            'bg-pink-100 text-pink-700',
  CLOSED_WON:             'bg-green-100 text-green-700',
  CLOSED_LOST:            'bg-red-100 text-red-700',
  DISQUALIFIED:           'bg-gray-200 text-gray-500',
};

const STAGES = ['NEW','CONTACTED','QUALIFIED','SITE_VISIT_SCHEDULED','SITE_VISIT_DONE','PROPOSAL_SENT','NEGOTIATION','CLOSED_WON','CLOSED_LOST','DISQUALIFIED'];
const SOURCES = ['MANUAL','WHATSAPP','SHEET_IMPORT','API','WEBSITE','REFERRAL','CAMPAIGN'];

export default function CrmLeadsPage() {
  const qc = useQueryClient();
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', systemKw: '', language: 'EN', notes: '' });

  const params = new URLSearchParams({ page: String(page), limit: '30' });
  if (stage) params.set('stage', stage);
  if (source) params.set('source', source);
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery<LeadsResponse>({
    queryKey: ['crm', 'leads', stage, source, search, page],
    queryFn: () => api<LeadsResponse>(`/crm/leads?${params}`),
    refetchInterval: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/crm/leads', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm', 'leads'] }); setShowAdd(false); setForm({ name: '', phone: '', email: '', city: '', systemKw: '', language: 'EN', notes: '' }); },
  });

  const leads = data?.leads ?? [];

  return (
    <div className="p-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM — Lead Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} leads total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/crm/import" className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
            📥 Import Sheet
          </Link>
          <button onClick={() => setShowAdd(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
            + New Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Search name, phone, city…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400 w-56"
        />
        <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }} className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No leads found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Phone', 'Stage', 'Score', 'Source', 'System kW', 'Events', 'Assigned To', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    {lead.email && <div className="text-xs text-gray-400">{lead.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLOR[lead.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                      {lead.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${lead.score}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{lead.source}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.systemKw ? `${lead.systemKw} kW` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{lead._count.events}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{lead.assignedTo?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/crm/${lead.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {data.page} of {data.pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Add New Lead</h2>
            <div className="space-y-3">
              {(['name', 'phone', 'email', 'city'] as const).map((f) => (
                <input key={f} placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={form[f]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
                />
              ))}
              <input placeholder="System size (kW)" type="number" value={form.systemKw}
                onChange={(e) => setForm((prev) => ({ ...prev, systemKw: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <select value={form.language} onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                <option value="EN">English</option>
                <option value="HI">Hindi</option>
                <option value="MR">Marathi</option>
              </select>
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => addMutation.mutate({ ...form, systemKw: form.systemKw ? Number(form.systemKw) : undefined })}
                disabled={addMutation.isPending || !form.name || !form.phone}
                className="flex-1 text-sm bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40 hover:bg-gray-700"
              >
                {addMutation.isPending ? 'Adding…' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
