'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceAdminApi, type CompOffRequest } from '@/lib/attendance-api';

export default function AdminCompOffPage() {
  const [items, setItems] = useState<CompOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await attendanceAdminApi.getAllCompOffs(filter || undefined)); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setDeciding(id);
    try {
      await attendanceAdminApi.decideCompOff(id, decision);
      await load();
    } finally { setDeciding(null); }
  };

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-50 text-yellow-700',
    APPROVED: 'bg-green-50 text-green-700',
    REJECTED: 'bg-red-50 text-red-700',
    USED: 'bg-blue-50 text-blue-700',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Comp Off Requests</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No comp off requests found.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{item.user?.name ?? 'Employee'}</div>
                  <div className="text-xs text-gray-400">{item.user?.designation}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[item.status] ?? ''}`}>
                  {item.status}
                </span>
              </div>
              <div className="text-sm text-gray-700 mb-1">
                Worked on Sunday: <span className="font-medium">{item.workDate}</span>
              </div>
              {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
              {item.status === 'PENDING' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => decide(item.id, 'APPROVED')}
                    disabled={deciding === item.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg py-2"
                  >
                    {deciding === item.id ? '…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => decide(item.id, 'REJECTED')}
                    disabled={deciding === item.id}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg py-2"
                  >
                    {deciding === item.id ? '…' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
