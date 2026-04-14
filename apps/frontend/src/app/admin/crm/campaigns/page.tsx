'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Campaign = {
  id: string; name: string; type: string; status: string; channel: string;
  sentCount: number; openCount: number; replyCount: number;
  scheduledAt: string | null; createdAt: string;
  _count: { enrollments: number };
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SCHEDULED: 'bg-blue-100 text-blue-700',
  RUNNING: 'bg-yellow-100 text-yellow-800', PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
};
const TYPE_ICON: Record<string, string> = { BROADCAST: '📣', DRIP: '💧', BEHAVIORAL: '⚡' };

const BLANK = { name: '', type: 'BROADCAST', channel: 'whatsapp', templateId: '', scheduledAt: '', targetFilter: '{"stage":"NEW"}' };

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [filterError, setFilterError] = useState('');

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api<Campaign[]>('/campaigns'),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setShowForm(false); setForm(BLANK); },
  });

  const launchMutation = useMutation({
    mutationFn: (id: string) => api(`/campaigns/${id}/launch`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  function handleCreate() {
    try {
      const targetFilter = JSON.parse(form.targetFilter || '{}');
      setFilterError('');
      createMutation.mutate({ ...form, targetFilter, scheduledAt: form.scheduledAt || undefined, templateId: form.templateId || undefined });
    } catch { setFilterError('Invalid JSON in Target Filter'); }
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campaign Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">Broadcast, Drip, and Behavioral campaigns</p>
        </div>
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
          + New Campaign
        </button>
      </div>

      {isLoading ? <div className="text-center text-gray-400 py-10">Loading…</div> : (
        <div className="space-y-3">
          {campaigns.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">No campaigns yet.</div>}
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_ICON[c.type] ?? '📋'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{c.channel}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Sent: {c.sentCount}</span>
                      <span>Enrollments: {c._count.enrollments}</span>
                      {c.scheduledAt && <span>Scheduled: {new Date(c.scheduledAt).toLocaleDateString('en-IN')}</span>}
                    </div>
                  </div>
                </div>
                {c.status === 'DRAFT' && c.type === 'BROADCAST' && (
                  <button onClick={() => launchMutation.mutate(c.id)} disabled={launchMutation.isPending}
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40">
                    🚀 Launch
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-8">
            <h2 className="text-base font-bold text-gray-900 mb-4">New Campaign</h2>
            <div className="space-y-3">
              <input placeholder="Campaign name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  <option value="BROADCAST">Broadcast</option>
                  <option value="DRIP">Drip</option>
                </select>
                <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <input placeholder="Template ID" value={form.templateId} onChange={(e) => setForm((p) => ({ ...p, templateId: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Target Filter (JSON)</label>
                <input value={form.targetFilter} onChange={(e) => setForm((p) => ({ ...p, targetFilter: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none font-mono" />
                <p className="text-xs text-gray-400 mt-0.5">e.g. {"{ \"stage\": \"NEW\", \"score_gte\": 30 }"}</p>
                {filterError && <p className="text-xs text-red-500 mt-0.5">{filterError}</p>}
              </div>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
              <button onClick={handleCreate} disabled={createMutation.isPending || !form.name}
                className="flex-1 text-sm bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40 hover:bg-gray-700">
                {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
