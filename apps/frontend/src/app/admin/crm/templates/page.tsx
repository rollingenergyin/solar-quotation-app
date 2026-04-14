'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Template = {
  id: string; name: string; category: string; channel: string;
  contentEn: string; contentHi: string | null; contentMr: string | null;
  variables: string[]; isActive: boolean;
};

const BLANK = { name: '', category: 'follow_up', channel: 'whatsapp', contentEn: '', contentHi: '', contentMr: '', variables: '' };
const CATEGORIES = ['welcome','follow_up','proposal','payment_reminder','qualification','site_visit_confirmation'];
const CHANNELS = ['whatsapp','email','sms','voice'];

export default function CrmTemplatesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [preview, setPreview] = useState<{ intent: string; language: string }>({ intent: 'follow_up', language: 'EN' });
  const [previewResult, setPreviewResult] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['crm-templates'],
    queryFn: () => api<Template[]>('/crm-templates'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/crm-templates', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-templates'] }); setShowForm(false); setForm(BLANK); },
  });

  async function generatePreview() {
    setPreviewing(true);
    try {
      const res = await api<{ content: string }>('/crm-templates/preview', {
        method: 'POST', body: JSON.stringify({ intent: preview.intent, language: preview.language, variables: { name: 'Rajesh', kw_size: 5, city: 'Pune' } }),
      });
      setPreviewResult(res.content);
    } catch { setPreviewResult('Failed to generate preview'); }
    setPreviewing(false);
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multilingual templates — EN / HI / MR</p>
        </div>
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
          + New Template
        </button>
      </div>

      {/* AI Preview Panel */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-indigo-900 mb-3">🤖 AI Content Preview</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={preview.intent} onChange={(e) => setPreview((p) => ({ ...p, intent: e.target.value }))}
            className="text-sm border border-indigo-200 rounded-lg px-3 py-2 bg-white outline-none">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
          </select>
          <select value={preview.language} onChange={(e) => setPreview((p) => ({ ...p, language: e.target.value }))}
            className="text-sm border border-indigo-200 rounded-lg px-3 py-2 bg-white outline-none">
            <option value="EN">English</option>
            <option value="HI">Hindi</option>
            <option value="MR">Marathi</option>
          </select>
          <button onClick={generatePreview} disabled={previewing}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            {previewing ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {previewResult && (
          <div className="bg-white rounded-xl p-4 text-sm text-gray-800 border border-indigo-100">{previewResult}</div>
        )}
      </div>

      {/* Template list */}
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
                {t.variables.length > 0 && (
                  <span className="text-gray-400">{t.variables.map((v) => `{{${v}}}`).join(' ')}</span>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className="col-span-2 text-center text-gray-400 py-10">No templates yet.</div>}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
            <h2 className="text-base font-bold text-gray-900 mb-4">New Message Template</h2>
            <div className="space-y-3">
              <input placeholder="Template name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input placeholder="Variables (comma-separated, e.g. name,kw_size,price)" value={form.variables}
                onChange={(e) => setForm((p) => ({ ...p, variables: e.target.value }))}
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
