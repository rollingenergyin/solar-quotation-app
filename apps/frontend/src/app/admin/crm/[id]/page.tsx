'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

const STAGES = ['NEW','CONTACTED','QUALIFIED','SITE_VISIT_SCHEDULED','SITE_VISIT_DONE','PROPOSAL_SENT','NEGOTIATION','CLOSED_WON','CLOSED_LOST','DISQUALIFIED'];
const STAGE_COLOR: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700', CONTACTED: 'bg-blue-100 text-blue-700', QUALIFIED: 'bg-indigo-100 text-indigo-700',
  SITE_VISIT_SCHEDULED: 'bg-yellow-100 text-yellow-800', SITE_VISIT_DONE: 'bg-orange-100 text-orange-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700', NEGOTIATION: 'bg-pink-100 text-pink-700',
  CLOSED_WON: 'bg-green-100 text-green-700', CLOSED_LOST: 'bg-red-100 text-red-700', DISQUALIFIED: 'bg-gray-200 text-gray-500',
};
const EVENT_ICON: Record<string, string> = {
  LEAD_CREATED: '✨', STAGE_CHANGED: '→', MESSAGE_SENT: '📤', MESSAGE_RECEIVED: '📥',
  NOTE_ADDED: '📝', SCORE_UPDATED: '⭐',
};

export default function CrmLeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [msgForm, setMsgForm] = useState({ channel: 'whatsapp', rawContent: '' });
  const [stageNote, setStageNote] = useState('');
  const [nextStage, setNextStage] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'messages'>('timeline');

  const { data: lead, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ['crm', 'lead', id],
    queryFn: () => api<Record<string, unknown>>(`/crm/leads/${id}`),
  });

  const stageMutation = useMutation({
    mutationFn: ({ stage, reason }: { stage: string; reason: string }) =>
      api(`/crm/leads/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage, reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm', 'lead', id] }); setNextStage(''); setStageNote(''); },
  });

  const msgMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/crm/leads/${id}/message`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm', 'lead', id] }); setMsgForm({ channel: 'whatsapp', rawContent: '' }); },
  });

  if (isLoading) return <div className="p-10 text-center text-gray-400">Loading…</div>;
  if (!lead) return <div className="p-10 text-center text-gray-400">Lead not found.</div>;

  const events = (lead.events as Record<string, unknown>[]) ?? [];
  const conversations = (lead.conversations as Record<string, unknown>[]) ?? [];
  const stage = String(lead.stage);

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/admin/crm" className="text-xs text-gray-400 hover:text-gray-600">← Back to CRM</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Lead info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">{String(lead.name)}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLOR[stage] ?? 'bg-gray-100 text-gray-600'}`}>
                {stage.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600">
              <div>📞 {String(lead.phone)}</div>
              {lead.email && <div>✉ {String(lead.email)}</div>}
              {lead.city && <div>📍 {String(lead.city)}</div>}
              {lead.systemKw && <div>⚡ {String(lead.systemKw)} kW system</div>}
              <div>🌐 {String(lead.language)} · {String(lead.source)}</div>
              <div className="flex items-center gap-1.5 pt-1">
                <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Number(lead.score)}%` }} />
                </div>
                <span className="text-xs text-gray-500">Score: {String(lead.score)}/100</span>
              </div>
            </div>
          </div>

          {/* Stage transition */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Move Stage</h3>
            <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 outline-none">
              <option value="">Select next stage…</option>
              {STAGES.filter((s) => s !== stage).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <input placeholder="Reason / note" value={stageNote} onChange={(e) => setStageNote(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 outline-none" />
            <button onClick={() => nextStage && stageMutation.mutate({ stage: nextStage, reason: stageNote })}
              disabled={!nextStage || stageMutation.isPending}
              className="w-full text-xs font-semibold py-2 rounded-lg bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-700">
              {stageMutation.isPending ? 'Moving…' : 'Confirm Stage Change'}
            </button>
          </div>

          {/* Send message */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Send Message</h3>
            <select value={msgForm.channel} onChange={(e) => setMsgForm((p) => ({ ...p, channel: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 outline-none">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <textarea placeholder="Message content…" value={msgForm.rawContent}
              onChange={(e) => setMsgForm((p) => ({ ...p, rawContent: e.target.value }))}
              rows={3} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 outline-none resize-none" />
            <button onClick={() => msgMutation.mutate(msgForm)} disabled={!msgForm.rawContent || msgMutation.isPending}
              className="w-full text-xs font-semibold py-2 rounded-lg bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-700">
              {msgMutation.isPending ? 'Sending…' : `Send via ${msgForm.channel}`}
            </button>
          </div>
        </div>

        {/* Right: Timeline + messages */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex border-b border-gray-100">
              {(['timeline', 'messages'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'text-gray-900 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-600'}`}>
                  {tab === 'timeline' ? `Timeline (${events.length})` : `Conversations (${conversations.length})`}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {activeTab === 'timeline' && (
                <ul className="space-y-3">
                  {events.map((e) => (
                    <li key={String(e.id)} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                        {EVENT_ICON[String(e.eventType)] ?? '·'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800">{String(e.eventType).replace(/_/g, ' ')}</div>
                        {e.fromStage && <div className="text-xs text-gray-500">{String(e.fromStage)} → {String(e.toStage)}</div>}
                        <div className="text-xs text-gray-400">
                          by {String(e.actor)} · {new Date(String(e.createdAt)).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </li>
                  ))}
                  {events.length === 0 && <p className="text-sm text-gray-400">No events yet.</p>}
                </ul>
              )}
              {activeTab === 'messages' && (
                <div className="space-y-4">
                  {conversations.map((conv) => {
                    const msgs = (conv.messages as Record<string, unknown>[]) ?? [];
                    return (
                      <div key={String(conv.id)}>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">{String(conv.channel)}</div>
                        <div className="space-y-2">
                          {msgs.map((m) => (
                            <div key={String(m.id)} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${m.direction === 'OUTBOUND' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                {String(m.content)}
                                <div className="text-xs opacity-60 mt-0.5">{new Date(String(m.sentAt)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                            </div>
                          ))}
                          {msgs.length === 0 && <p className="text-sm text-gray-400">No messages yet.</p>}
                        </div>
                      </div>
                    );
                  })}
                  {conversations.length === 0 && <p className="text-sm text-gray-400">No conversations yet.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
