'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceAdminApi, type AdminDailyEntry, statusColor, statusLabel, formatTime } from '@/lib/attendance-api';

function CorrectModal({
  entry,
  onClose,
  onSave,
}: {
  entry: AdminDailyEntry;
  onClose: () => void;
  onSave: () => void;
}) {
  const [field, setField] = useState('status');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!entry.dayId) return;
    if (!reason.trim()) return setError('Reason is required');
    setSaving(true);
    setError('');
    try {
      await attendanceAdminApi.correct({ attendanceDayId: entry.dayId, field, newValue, reason });
      onSave();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Correct: {entry.name}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Field</label>
          <select value={field} onChange={(e) => setField(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
            <option value="status">Status</option>
            <option value="isLate">Is Late</option>
            <option value="checkIn.description">Check-In Description</option>
            <option value="checkOut.fullDayUpdate">Full Day Update</option>
            <option value="checkOut.nextDayPlan">Next Day Plan</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">New Value</label>
          {field === 'status' ? (
            <select value={newValue} onChange={(e) => setNewValue(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">Select…</option>
              {['NONE', 'IN_PROGRESS', 'COMPLETE', 'ABSENT', 'ON_LEAVE', 'HOLIDAY'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : field === 'isLate' ? (
            <select value={newValue} onChange={(e) => setNewValue(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">Select…</option>
              <option value="true">Yes (Late)</option>
              <option value="false">No</option>
            </select>
          ) : (
            <textarea value={newValue} onChange={(e) => setNewValue(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Reason <span className="text-red-500">*</span></label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you correcting this?"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm">Cancel</button>
          <button onClick={save} disabled={saving || !newValue}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-gray-900 font-semibold rounded-xl py-2.5 text-sm">
            {saving ? 'Saving…' : 'Save Correction'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, onCorrect }: { entry: AdminDailyEntry; onCorrect: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const backendBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-gray-900 text-sm">{entry.name}</div>
          <div className="text-xs text-gray-400">{entry.designation ?? entry.role}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(entry.status)}`}>
            {statusLabel(entry.status)}
          </span>
          {entry.dayId && (
            <button onClick={onCorrect} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5">
              Correct
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">In: </span>
          {formatTime(entry.checkInAt)}
          {entry.isLate && <span className="ml-1 text-orange-500">(Late {entry.lateMinutes}m)</span>}
        </div>
        <div><span className="text-gray-400">Out: </span>{formatTime(entry.checkOutAt)}</div>
      </div>

      {entry.checkInAt && (
        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">
          {expanded ? 'Hide details ▲' : 'Show details ▼'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-50 pt-3">
          {entry.selfieKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${backendBase}/api/attendance/admin/selfie/${entry.selfieKey}`}
              alt="Selfie"
              className="w-24 h-24 rounded-xl object-cover"
            />
          )}
          {entry.description && <p className="text-xs text-gray-600"><span className="font-medium">Description: </span>{entry.description}</p>}
          {entry.fullDayUpdate && <p className="text-xs text-gray-600"><span className="font-medium">Day Update: </span>{entry.fullDayUpdate}</p>}
          {entry.nextDayPlan && <p className="text-xs text-gray-600"><span className="font-medium">Tomorrow: </span>{entry.nextDayPlan}</p>}
          {entry.checkInLat != null && (
            <a
              href={`https://maps.google.com/?q=${entry.checkInLat},${entry.checkInLng}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 underline"
            >
              View Check-In Location ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAttendanceDailyPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<AdminDailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [correctEntry, setCorrectEntry] = useState<AdminDailyEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await attendanceAdminApi.getDailyView(date)); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const present = entries.filter((e) => e.status === 'COMPLETE' || e.status === 'IN_PROGRESS');
  const absent = entries.filter((e) => e.status === 'NONE' || e.status === 'ABSENT');
  const late = entries.filter((e) => e.isLate);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Daily Attendance</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{present.length}</div>
          <div className="text-xs text-gray-500">Present</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{absent.length}</div>
          <div className="text-xs text-gray-500">Absent</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{late.length}</div>
          <div className="text-xs text-gray-500">Late</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard key={entry.userId} entry={entry} onCorrect={() => setCorrectEntry(entry)} />
          ))}
        </div>
      )}

      {correctEntry && (
        <CorrectModal
          entry={correctEntry}
          onClose={() => setCorrectEntry(null)}
          onSave={async () => { setCorrectEntry(null); await load(); }}
        />
      )}
    </div>
  );
}
