'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface AuditLog {
  id: string; action: string; entity: string; entityId: string;
  before: unknown; after: unknown; ipAddress?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

const ENTITIES = ['', 'material', 'formula', 'weekly_price', 'category', 'bill'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE'];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      ...(entity && { entity }),
    });
    const data = await api<{ logs: AuditLog[]; total: number }>(`/audit?${params}`);
    const filtered = action ? data.logs.filter((l) => l.action === action) : data.logs;
    setLogs(filtered);
    setTotal(data.total);
  }, [page, entity, action]);

  useEffect(() => { load(); }, [load]);

  const actionColor: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total entries</p>
        </div>
        <button onClick={load} className="text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors">Refresh</button>
      </div>

      <div className="flex gap-3 mb-4">
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400">
          {ENTITIES.map((e) => <option key={e} value={e}>{e || 'All entities'}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400">
          {ACTIONS.map((a) => <option key={a} value={a}>{a || 'All actions'}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Time', 'User', 'Action', 'Entity', 'Entity ID', 'Changes', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map((log) => (
              <>
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-700">{log.user?.name}</div>
                    <div className="text-xs text-gray-400">{log.user?.role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${actionColor[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{log.entity}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.entityId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {log.before && log.after ? 'Diff' : log.after ? 'Added' : log.before ? 'Removed' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {(log.before != null || log.after != null) ? (
                      <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="text-xs text-blue-600 hover:text-blue-800">
                        {expanded === log.id ? 'Hide' : 'View'}
                      </button>
                    ) : null}
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr key={`${log.id}-exp`} className="bg-gray-50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-4">
                        {log.before != null ? (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 mb-1">Before</div>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-40 text-gray-600">
                              {JSON.stringify(log.before, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                        {log.after != null ? (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 mb-1">After</div>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-40 text-gray-600">
                              {JSON.stringify(log.after, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-center py-12 text-sm text-gray-400">No audit logs found.</p>}
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-xs text-gray-400">Page {page + 1}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}
            className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">Prev</button>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}
            className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
}
