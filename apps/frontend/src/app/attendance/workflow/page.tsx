'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceApi, type WorkflowRequest, type WorkflowType } from '@/lib/attendance-api';

const TYPES: { value: WorkflowType; label: string; icon: string }[] = [
  { value: 'PRICING', label: 'Pricing Approval', icon: '₹' },
  { value: 'DISCOUNT', label: 'Discount Request', icon: '%' },
  { value: 'COMPLAINT', label: 'Complaint / Issue', icon: '⚠' },
  { value: 'OTHER', label: 'Other Request', icon: '📋' },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700',
  IN_REVIEW: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  CLOSED: 'bg-gray-50 text-gray-600',
};

export default function WorkflowPage() {
  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<WorkflowType>('PRICING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRequests(await attendanceApi.getMyWorkflows()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!title.trim() || !description.trim()) return setError('Title and description are required');
    setSubmitting(true);
    setError('');
    try {
      await attendanceApi.createWorkflow({ type, title, description });
      setShowForm(false);
      setTitle(''); setDescription('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Approvals & Requests</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Request'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New Request</h2>

          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`rounded-xl p-3 text-sm font-medium flex items-center gap-2 border-2 transition-colors ${
                  type === t.value ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-700'
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief title for the request…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Details <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the request…" rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          <button onClick={submit} disabled={submitting}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-gray-900 font-semibold rounded-xl py-3 text-sm transition-colors">
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No requests yet.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-1">
                <div className="font-medium text-sm text-gray-900">{req.title}</div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] ?? ''}`}>
                  {req.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-2">{req.type} · {new Date(req.createdAt).toLocaleDateString('en-IN')}</div>
              <p className="text-xs text-gray-600 line-clamp-2">{req.description}</p>
              {req.approvals && req.approvals.length > 0 && (
                <div className="mt-2 space-y-1">
                  {req.approvals.map((a) => (
                    <div key={a.id} className="text-xs bg-gray-50 rounded-lg px-2 py-1">
                      <span className="font-medium text-gray-700">{a.approver.name}</span>
                      <span className={`ml-1 ${a.decision === 'APPROVED' ? 'text-green-600' : a.decision === 'REJECTED' ? 'text-red-600' : 'text-blue-600'}`}>
                        {a.decision}
                      </span>
                      {a.comment && <span className="text-gray-500"> — {a.comment}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
