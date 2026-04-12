'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceApi, type AttendanceDay, statusColor, statusLabel, formatTime } from '@/lib/attendance-api';

export default function AttendanceHistoryPage() {
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await attendanceApi.getHistory(from, to);
      setDays(data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const presentCount = days.filter((d) => d.status === 'COMPLETE' || d.status === 'IN_PROGRESS').length;
  const lateCount = days.filter((d) => d.isLate).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">My Attendance History</h1>

      {/* Date range */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{presentCount}</div>
          <div className="text-xs text-gray-500">Present</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{lateCount}</div>
          <div className="text-xs text-gray-500">Late</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{days.filter((d) => d.status === 'ABSENT').length}</div>
          <div className="text-xs text-gray-500">Absent</div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : days.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No records found for this period.</div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <div key={day.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 text-sm">{day.date}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(day.status)}`}>
                  {statusLabel(day.status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>
                  <span className="text-gray-400">In: </span>
                  {formatTime(day.checkIn?.capturedAt)}
                  {day.isLate && <span className="ml-1 text-orange-500">(Late {day.lateMinutes}m)</span>}
                </div>
                <div>
                  <span className="text-gray-400">Out: </span>
                  {formatTime(day.checkOut?.capturedAt)}
                </div>
              </div>
              {day.checkIn?.description && (
                <div className="mt-2 text-xs text-gray-500 border-t border-gray-50 pt-2 line-clamp-2">
                  {day.checkIn.description}
                </div>
              )}
              {day.checkOut?.fullDayUpdate && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-600">Day update</summary>
                  <p className="mt-1 text-gray-600 pl-2 border-l-2 border-gray-200">{day.checkOut.fullDayUpdate}</p>
                  {day.checkOut.nextDayPlan && (
                    <p className="mt-1 text-gray-500 pl-2 border-l-2 border-yellow-200">Tomorrow: {day.checkOut.nextDayPlan}</p>
                  )}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
