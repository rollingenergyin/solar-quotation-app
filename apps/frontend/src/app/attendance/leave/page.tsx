'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceApi, type LeaveRequest, type LeaveType } from '@/lib/attendance-api';

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'PLANNED', label: 'Planned Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'CASUAL', label: 'Casual Leave' },
  { value: 'EMERGENCY', label: 'Emergency Leave' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-50 text-gray-600',
};

export default function LeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<LeaveType>('PLANNED');
  const [reason, setReason] = useState('');
  const [emergency, setEmergency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setLeaves(await attendanceApi.getMyLeaves()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!startDate || !endDate) return setError('Please select dates');
    if (!reason.trim()) return setError('Reason is required');
    if (type === 'EMERGENCY' && !emergency.trim()) return setError('Emergency justification required');

    setSubmitting(true);
    setError('');
    try {
      await attendanceApi.applyLeave({ startDate, endDate, type, reason, emergencyJustification: emergency });
      setShowForm(false);
      setStartDate(''); setEndDate(''); setReason(''); setEmergency('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const minDate = type === 'EMERGENCY' ? today : new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          {showForm ? 'Cancel' : '+ Apply Leave'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New Leave Request</h2>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Leave Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {type !== 'EMERGENCY' && (
              <p className="text-xs text-gray-500 mt-1">Must be applied at least 2 days in advance.</p>
            )}
            {type === 'EMERGENCY' && (
              <p className="text-xs text-orange-600 mt-1">Emergency leave requires stricter approval and justification.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">From</label>
              <input type="date" value={startDate} min={minDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To</label>
              <input type="date" value={endDate} min={startDate || minDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave…" rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
          </div>

          {type === 'EMERGENCY' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Emergency Justification <span className="text-red-500">*</span></label>
              <textarea value={emergency} onChange={(e) => setEmergency(e.target.value)} placeholder="Why is this emergency?" rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          <button onClick={submit} disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : leaves.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No leave requests yet.</div>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => (
            <div key={leave.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-medium text-sm text-gray-900">{leave.startDate} – {leave.endDate}</span>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{leave.type}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[leave.status] ?? ''}`}>
                  {leave.status}
                </span>
              </div>
              <p className="text-xs text-gray-600">{leave.reason}</p>
              {leave.emergencyJustification && (
                <p className="text-xs text-orange-600 mt-1">Emergency: {leave.emergencyJustification}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
