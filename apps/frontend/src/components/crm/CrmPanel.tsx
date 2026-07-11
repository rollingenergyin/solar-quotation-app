'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string; name: string; phone: string; email: string | null;
  city: string | null; stage: string; score: number; source: string;
  language: string; systemKw: number | null; createdAt: string;
  assignedTo: { id: string; name: string } | null;
  _count: { events: number; conversations: number };
};
type LeadsResponse = { leads: Lead[]; total: number; page: number; pages: number };

type Rule = {
  id: string; name: string; description: string | null; isActive: boolean;
  trigger: { event: string; filter?: Record<string, unknown> };
  conditions: unknown[]; actions: unknown[]; loopGuard: number; priority: number;
  _count: { executions: number };
};

type Template = {
  id: string; name: string; category: string; channel: string;
  contentEn: string; contentHi: string | null; contentMr: string | null;
  variables: string[]; isActive: boolean;
};

type Campaign = {
  id: string; name: string; type: string; status: string; channel: string;
  sentCount: number; openCount: number; replyCount: number;
  scheduledAt: string | null; createdAt: string;
  _count: { enrollments: number };
};

type AnalyticsData = {
  today: { leadsCreated: number; messagesSent: number };
  funnel: { stage: string; count: number }[];
  sources: { source: string; count: number }[];
  totalLeads: number; avgScore: number;
};

type ImportRecord = {
  id: string; filename: string; totalRows: number; imported: number;
  duplicates: number; failed: number; status: string;
  createdAt: string; completedAt: string | null;
  errorReport: { row: number; reason: string }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700', CONTACTED: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-indigo-100 text-indigo-700', SITE_VISIT_SCHEDULED: 'bg-yellow-100 text-yellow-800',
  SITE_VISIT_DONE: 'bg-orange-100 text-orange-700', PROPOSAL_SENT: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-pink-100 text-pink-700', CLOSED_WON: 'bg-green-100 text-green-700',
  CLOSED_LOST: 'bg-red-100 text-red-700', DISQUALIFIED: 'bg-gray-200 text-gray-500',
};
const STAGES = ['NEW','CONTACTED','QUALIFIED','SITE_VISIT_SCHEDULED','SITE_VISIT_DONE','PROPOSAL_SENT','NEGOTIATION','CLOSED_WON','CLOSED_LOST','DISQUALIFIED'];
const SOURCES = ['MANUAL','WHATSAPP','SHEET_IMPORT','API','WEBSITE','REFERRAL','CAMPAIGN'];
const STAGE_CHART_COLORS = ['#6366f1','#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6b7280'];
const SOURCE_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899'];
const EVENT_OPTIONS = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.stage_changed', label: 'Stage Changed' },
  { value: 'lead.message_received', label: 'Message Received' },
  { value: 'lead.message_sent', label: 'Message Sent' },
];
const CATEGORIES = ['welcome','follow_up','proposal','payment_reminder','qualification','site_visit_confirmation'];
const CHANNELS = ['whatsapp','email','sms','voice'];
const STATUS_COLOR_IMPORT: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600', PROCESSING: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700',
};
const STATUS_COLOR_CAMPAIGN: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SCHEDULED: 'bg-blue-100 text-blue-700',
  RUNNING: 'bg-yellow-100 text-yellow-800', PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
};
const TYPE_ICON: Record<string, string> = { BROADCAST: '📣', DRIP: '💧', BEHAVIORAL: '⚡' };

const TABS = [
  { id: 'pipeline',   label: 'Pipeline',   icon: '🎯' },
  { id: 'analytics',  label: 'Analytics',  icon: '📈' },
  { id: 'campaigns',  label: 'Campaigns',  icon: '📣' },
  { id: 'automation', label: 'Automation', icon: '⚙️' },
  { id: 'templates',  label: 'Templates',  icon: '💬' },
  { id: 'import',     label: 'Import',     icon: '📥' },
] as const;
type TabId = typeof TABS[number]['id'];

// ═══════════════════════════════════════════════════════════════
// TAB: PIPELINE
// ═══════════════════════════════════════════════════════════════

function PipelineTab({ basePath }: { basePath: string }) {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', city: '', systemKw: '', language: 'EN', notes: '' });
    },
  });

  const leads = data?.leads ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input placeholder="Search name, phone, city…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400 w-52" />
        <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">{data?.total ?? 0} leads</span>
        <button onClick={() => setShowAdd(true)}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
          + New Lead
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No leads found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Phone', 'Stage', 'Score', 'Source', 'System kW', 'Events', 'Assigned To', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
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
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.phone}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLOR[lead.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {lead.stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
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
                      {/* basePath makes link work from both /admin/crm and /sales/crm */}
                      <Link href={`${basePath}/${lead.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {data.page} of {data.pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Add New Lead</h2>
            <div className="space-y-3">
              {(['name', 'phone', 'email', 'city'] as const).map((f) => (
                <input key={f} placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={form[f]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              ))}
              <input placeholder="System size (kW)" type="number" value={form.systemKw}
                onChange={(e) => setForm((prev) => ({ ...prev, systemKw: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              <select value={form.language} onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                <option value="EN">English</option>
                <option value="HI">Hindi</option>
                <option value="MR">Marathi</option>
              </select>
              <textarea placeholder="Notes" value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-yellow-400" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => addMutation.mutate({ ...form, systemKw: form.systemKw ? Number(form.systemKw) : undefined })}
                disabled={addMutation.isPending || !form.name || !form.phone}
                className="flex-1 text-sm bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40 hover:bg-gray-700">
                {addMutation.isPending ? 'Adding…' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ANALYTICS
// ═══════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['crm', 'analytics'],
    queryFn: () => api<AnalyticsData>('/crm/analytics'),
    refetchInterval: 30_000,
  });
  const funnel = data?.funnel ?? [];
  const sources = data?.sources ?? [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">↻ Refresh</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Leads', value: data?.totalLeads ?? '—', icon: '🎯', color: 'bg-indigo-500' },
          { label: 'Leads Today', value: data?.today.leadsCreated ?? '—', icon: '✨', color: 'bg-green-500' },
          { label: 'Messages Sent Today', value: data?.today.messagesSent ?? '—', icon: '📤', color: 'bg-blue-500' },
          { label: 'Avg Score', value: data ? `${data.avgScore}/100` : '—', icon: '⭐', color: 'bg-yellow-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div className={`w-2 h-2 rounded-full ${card.color} mt-1`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{String(card.value)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Funnel by Stage</h2>
          {isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnel} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="stage" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.replace(/_/g,' ').slice(0, 8)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={36}>
                  {funnel.map((_, i) => <Cell key={i} fill={STAGE_CHART_COLORS[i % STAGE_CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Sources</h2>
          {isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={75}
                  label={(props) => {
                    const p = props.payload as { source?: string };
                    return `${String(p?.source ?? '')} ${Math.round((props.percent ?? 0) * 100)}%`;
                  }}>
                  {sources.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Stage Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Stage</th>
              <th className="text-right pb-2 font-medium">Leads</th>
              <th className="text-right pb-2 font-medium">% of Total</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {funnel.map((row, i) => {
              const pct = data?.totalLeads ? Math.round((row.count / data.totalLeads) * 100) : 0;
              return (
                <tr key={row.stage} className="border-b border-gray-50">
                  <td className="py-2.5 text-gray-800">{row.stage.replace(/_/g,' ')}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{row.count}</td>
                  <td className="py-2.5 text-right text-gray-500">{pct}%</td>
                  <td className="py-2.5 pl-3 w-28">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAGE_CHART_COLORS[i % STAGE_CHART_COLORS.length] }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

function CampaignsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'BROADCAST', channel: 'whatsapp', templateId: '', scheduledAt: '', targetFilter: '{"stage":"NEW"}' });
  const [filterError, setFilterError] = useState('');

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api<Campaign[]>('/campaigns'),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setShowForm(false); setForm({ name: '', type: 'BROADCAST', channel: 'whatsapp', templateId: '', scheduledAt: '', targetFilter: '{"stage":"NEW"}' }); },
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
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">+ New Campaign</button>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR_CAMPAIGN[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
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
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  <option value="BROADCAST">Broadcast</option><option value="DRIP">Drip</option>
                </select>
                <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option>
                </select>
              </div>
              <input placeholder="Template ID" value={form.templateId} onChange={(e) => setForm((p) => ({ ...p, templateId: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Target Filter (JSON)</label>
                <input value={form.targetFilter} onChange={(e) => setForm((p) => ({ ...p, targetFilter: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none font-mono" />
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

// ═══════════════════════════════════════════════════════════════
// TAB: AUTOMATION
// ═══════════════════════════════════════════════════════════════

const BLANK_RULE = {
  name: '', description: '', triggerEvent: 'lead.created', triggerFilter: '{}',
  conditions: '[]',
  actions: JSON.stringify([{ type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 0 }], null, 2),
  loopGuard: 1, priority: 0,
};

function AutomationTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_RULE);
  const [jsonError, setJsonError] = useState('');

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ['automation', 'rules'],
    queryFn: () => api<Rule[]>('/automation/rules'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/automation/rules', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automation', 'rules'] }); setShowForm(false); setForm(BLANK_RULE); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/automation/rules/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation', 'rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/automation/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation', 'rules'] }),
  });

  function handleSubmit() {
    try {
      const trigger = { event: form.triggerEvent, filter: JSON.parse(form.triggerFilter || '{}') };
      const conditions = JSON.parse(form.conditions || '[]');
      const actions = JSON.parse(form.actions);
      setJsonError('');
      createMutation.mutate({ name: form.name, description: form.description, trigger, conditions, actions, loopGuard: form.loopGuard, priority: form.priority });
    } catch { setJsonError('Invalid JSON in conditions or actions'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">+ New Rule</button>
      </div>
      {isLoading ? <div className="text-center text-gray-400 py-10">Loading…</div> : (
        <div className="space-y-3">
          {rules.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">No automation rules yet.</div>}
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="font-semibold text-gray-900">{rule.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{rule.trigger.event}</span>
                    <span className="text-xs text-gray-400">{rule._count.executions} runs</span>
                  </div>
                  {rule.description && <p className="text-sm text-gray-500 mb-2">{rule.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {(rule.actions as Record<string, unknown>[]).map((a, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{String(a.type)}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <button onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${rule.isActive ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {rule.isActive ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => deleteMutation.mutate(rule.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
            <h2 className="text-base font-bold text-gray-900 mb-4">New Automation Rule</h2>
            <div className="space-y-3">
              <input placeholder="Rule name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              <input placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Trigger Event</label>
                  <select value={form.triggerEvent} onChange={(e) => setForm((p) => ({ ...p, triggerEvent: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                    {EVENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Loop Guard (max/day)</label>
                  <input type="number" value={form.loopGuard} min={1} max={10}
                    onChange={(e) => setForm((p) => ({ ...p, loopGuard: Number(e.target.value) }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Trigger Filter (JSON)</label>
                <input value={form.triggerFilter} onChange={(e) => setForm((p) => ({ ...p, triggerFilter: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Conditions (JSON array)</label>
                <textarea value={form.conditions} onChange={(e) => setForm((p) => ({ ...p, conditions: e.target.value }))}
                  rows={3} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none font-mono resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Actions (JSON array) *</label>
                <textarea value={form.actions} onChange={(e) => setForm((p) => ({ ...p, actions: e.target.value }))}
                  rows={5} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none font-mono resize-none" />
              </div>
              {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || !form.name}
                className="flex-1 text-sm bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40 hover:bg-gray-700">
                {createMutation.isPending ? 'Saving…' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: TEMPLATES
// ═══════════════════════════════════════════════════════════════

const BLANK_TEMPLATE = { name: '', category: 'follow_up', channel: 'whatsapp', contentEn: '', contentHi: '', contentMr: '', variables: '' };

function TemplatesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_TEMPLATE);
  const [preview, setPreview] = useState<{ intent: string; language: string }>({ intent: 'follow_up', language: 'EN' });
  const [previewResult, setPreviewResult] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['crm-templates'],
    queryFn: () => api<Template[]>('/crm-templates'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/crm-templates', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-templates'] }); setShowForm(false); setForm(BLANK_TEMPLATE); },
  });

  async function generatePreview() {
    setPreviewing(true);
    try {
      const res = await api<{ content: string }>('/crm-templates/preview', {
        method: 'POST',
        body: JSON.stringify({ intent: preview.intent, language: preview.language, variables: { name: 'Rajesh', kw_size: 5, city: 'Pune' } }),
      });
      setPreviewResult(res.content);
    } catch { setPreviewResult('Failed to generate preview'); }
    setPreviewing(false);
  }

  return (
    <div>
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-indigo-900 mb-3">🤖 AI Content Preview</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={preview.intent} onChange={(e) => setPreview((p) => ({ ...p, intent: e.target.value }))}
            className="text-sm border border-indigo-200 rounded-lg px-3 py-2 bg-white outline-none">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
          </select>
          <select value={preview.language} onChange={(e) => setPreview((p) => ({ ...p, language: e.target.value }))}
            className="text-sm border border-indigo-200 rounded-lg px-3 py-2 bg-white outline-none">
            <option value="EN">English</option><option value="HI">Hindi</option><option value="MR">Marathi</option>
          </select>
          <button onClick={generatePreview} disabled={previewing}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            {previewing ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {previewResult && <div className="bg-white rounded-xl p-4 text-sm text-gray-800 border border-indigo-100">{previewResult}</div>}
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">+ New Template</button>
      </div>
      {isLoading ? <div className="text-center text-gray-400 py-10">Loading…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="font-semibold text-sm text-gray-900">{t.name}</span>
                <div className="flex gap-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.channel}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-2 line-clamp-2">{t.contentEn}</p>
              <div className="flex gap-2 text-xs">
                {t.contentHi && <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">HI ✓</span>}
                {t.contentMr && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">MR ✓</span>}
                {t.variables.length > 0 && <span className="text-gray-400">{t.variables.map((v) => `{{${v}}}`).join(' ')}</span>}
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className="col-span-2 text-center text-gray-400 py-10">No templates yet.</div>}
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
            <h2 className="text-base font-bold text-gray-900 mb-4">New Message Template</h2>
            <div className="space-y-3">
              <input placeholder="Template name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input placeholder="Variables (comma-separated)" value={form.variables} onChange={(e) => setForm((p) => ({ ...p, variables: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
              {[['contentEn','English *'], ['contentHi','Hindi'], ['contentMr','Marathi']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                  <textarea value={form[key as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    rows={3} placeholder={`Content in ${label.replace(' *','')}…`}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
              <button onClick={() => createMutation.mutate({ ...form, variables: form.variables.split(',').map((v) => v.trim()).filter(Boolean) })}
                disabled={createMutation.isPending || !form.name || !form.contentEn}
                className="flex-1 text-sm bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40 hover:bg-gray-700">
                {createMutation.isPending ? 'Saving…' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: IMPORT
// ═══════════════════════════════════════════════════════════════

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastImportId, setLastImportId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: importStatus } = useQuery<ImportRecord>({
    queryKey: ['crm', 'import', lastImportId],
    queryFn: () => api<ImportRecord>(`/crm/import/${lastImportId}`),
    enabled: !!lastImportId,
    refetchInterval: (query) => {
      const status = (query.state.data as ImportRecord | undefined)?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  const isProcessing = importStatus?.status === 'PROCESSING' || importStatus?.status === 'PENDING';

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/crm/import/sheet', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { importId: string };
      setLastImportId(data.importId);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { setError((e as Error).message); }
    finally { setUploading(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center mb-5">
        <div className="text-4xl mb-3">📥</div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Drop your Excel or CSV file here</p>
        <p className="text-xs text-gray-400 mb-4">
          Required: <code className="bg-gray-100 px-1.5 py-0.5 rounded">name</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">phone</code> — optional: email, city, state, kw, language
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading || isProcessing}
          className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors">
          {uploading ? 'Uploading…' : isProcessing ? 'Processing…' : 'Choose File'}
        </button>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      </div>
      {importStatus && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-semibold text-gray-900">{importStatus.filename}</span>
              <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR_IMPORT[importStatus.status]}`}>{importStatus.status}</span>
            </div>
            <span className="text-xs text-gray-400">{new Date(importStatus.createdAt).toLocaleString('en-IN')}</span>
          </div>
          {isProcessing && <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4"><div className="h-full bg-yellow-400 rounded-full animate-pulse" style={{ width: '60%' }} /></div>}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Rows', value: importStatus.totalRows, color: 'text-gray-900' },
              { label: 'Imported', value: importStatus.imported, color: 'text-green-600' },
              { label: 'Duplicates', value: importStatus.duplicates, color: 'text-orange-600' },
              { label: 'Failed', value: importStatus.failed, color: 'text-red-600' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 bg-gray-50 rounded-xl">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT EXPORT — accepts basePath to make links context-aware
//               and allowedTabs to restrict visible tabs
// ═══════════════════════════════════════════════════════════════

export default function CrmPanel({
  basePath,
  allowedTabs,
}: {
  basePath: string;
  allowedTabs?: TabId[];
}) {
  const visibleTabs = allowedTabs
    ? TABS.filter((t) => allowedTabs.includes(t.id))
    : TABS;

  const [activeTab, setActiveTab] = useState<TabId>(
    allowedTabs ? allowedTabs[0] : 'pipeline'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-5 pt-5 pb-0 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Solar Growth OS — CRM</h1>
              <p className="text-xs text-gray-400 mt-0.5">Event-driven CRM · Automation · AI Messaging · Campaigns</p>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-px">
            {visibleTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto p-5">
        {activeTab === 'pipeline'   && <PipelineTab basePath={basePath} />}
        {activeTab === 'analytics'  && <AnalyticsTab />}
        {activeTab === 'campaigns'  && <CampaignsTab />}
        {activeTab === 'automation' && <AutomationTab />}
        {activeTab === 'templates'  && <TemplatesTab />}
        {activeTab === 'import'     && <ImportTab />}
      </div>
    </div>
  );
}
