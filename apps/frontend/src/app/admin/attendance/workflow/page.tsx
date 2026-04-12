'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceAdminApi, type WorkflowRequest } from '@/lib/attendance-api';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700',
  IN_REVIEW: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  CLOSED: 'bg-gray-50 text-gray-600',
};

function DecideModal({ req, onClose, onSave }: { req: WorkflowRequest; onClose: () => void; onSave: () => void }) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'COMMENT'>('APPROVED');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await attendanceAdminApi.decideWorkflow(req.id, decision, comment);
      onSave();
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Decide: {req.title}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="flex gap-2">
          {(['APPROVED', 'REJECTED', 'COMMENT'] as const).map((d) => (
            <button key={d} onClick={() => setDecision(d)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium border-2 transition-colors ${
                decision === d
                  ? d === 'APPROVED' ? 'border-green-500 bg-green-50 text-green-700' : d === 'REJECTED' ? 'border-red-500 bg-red-50 text-red-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600'
              }`}>
              {d}
            </button>
          ))}
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Comment (optional)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-gray-900 font-semibold rounded-xl py-2.5 text-sm">
            {saving ? 'Saving…' : 'Save Decision'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminWorkflowPage() {
  const [items, setItems] = useState<WorkflowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [deciding, setDeciding] = useState<WorkflowRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await attendanceAdminApi.getAllWorkflows(filter || undefined)); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Workflow Requests</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No requests found.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{item.title}</div>
                  <div className="text-xs text-gray-400">{item.requester?.name} · {item.type}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? ''}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{item.description}</p>
              {item.approvals && item.approvals.length > 0 && (
                <div className="mb-2 space-y-1">
                  {item.approvals.map((a) => (
                    <div key={a.id} className="text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="font-medium">{a.approver.name}</span>
                      <span className={`ml-1 ${a.decision === 'APPROVED' ? 'text-green-600' : a.decision === 'REJECTED' ? 'text-red-600' : 'text-blue-600'}`}>
                        {a.decision}
                      </span>
                      {a.comment && <span className="text-gray-500"> — {a.comment}</span>}
                    </div>
                  ))}
                </div>
              )}
              {(item.status === 'OPEN' || item.status === 'IN_REVIEW') && (
                <button onClick={() => setDeciding(item)}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold text-sm rounded-lg py-2">
                  Review / Decide
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {deciding && (
        <DecideModal
          req={deciding}
          onClose={() => setDeciding(null)}
          onSave={async () => { setDeciding(null); await load(); }}
        />
      )}
    </div>
  );
}
