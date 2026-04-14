'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Rule = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: { event: string; filter?: Record<string, unknown> };
  conditions: unknown[];
  actions: unknown[];
  loopGuard: number;
  priority: number;
  _count: { executions: number };
};

const EVENT_OPTIONS = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.stage_changed', label: 'Stage Changed' },
  { value: 'lead.message_received', label: 'Message Received' },
  { value: 'lead.message_sent', label: 'Message Sent' },
];

const ACTION_TYPES = [
  { value: 'send_whatsapp', label: 'Send WhatsApp' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'change_stage', label: 'Change Stage' },
  { value: 'add_note', label: 'Add Note' },
  { value: 'assign_rep', label: 'Assign Rep' },
  { value: 'recalculate_score', label: 'Recalculate Score' },
];

const BLANK_RULE = {
  name: '', description: '', triggerEvent: 'lead.created',
  triggerFilter: '{}', conditions: '[]',
  actions: JSON.stringify([{ type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 0 }], null, 2),
  loopGuard: 1, priority: 0,
};

export default function AutomationPage() {
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
    } catch {
      setJsonError('Invalid JSON in conditions or actions');
    }
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Automation Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Event-driven automations — run automatically when triggers fire</p>
        </div>
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
          + New Rule
        </button>
      </div>

      {isLoading ? <div className="text-center text-gray-400 py-10">Loading…</div> : (
        <div className="space-y-3">
          {rules.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">No automation rules yet. Create your first rule to get started.</div>}
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="font-semibold text-gray-900">{rule.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {rule.trigger.event}
                    </span>
                    <span className="text-xs text-gray-400">{rule._count.executions} runs</span>
                  </div>
                  {rule.description && <p className="text-sm text-gray-500 mb-2">{rule.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {(rule.actions as Record<string, unknown>[]).map((a, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {String(a.type)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
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

      {/* Create rule modal */}
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
                <label className="text-xs font-medium text-gray-500 block mb-1">Trigger Filter (JSON) — e.g. {'{"toStage":"CONTACTED"}'}</label>
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
