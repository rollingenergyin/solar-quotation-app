'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface ProjectSummary {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  totalCost: number;
  totalRevenue: number;
  profit: number;
}

interface SummaryMap {
  [id: string]: { totalCost: number; totalRevenue: number; profit: number };
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ id: string; name: string; code: string | null; status: string | null }[]>('/finance/projects'),
      api<ProjectSummary[]>('/finance/projects-summary'),
    ])
      .then(([projectsList, summaries]) => {
        const summaryMap: SummaryMap = Object.fromEntries(
          summaries.map((s) => [s.id, { totalCost: s.totalCost, totalRevenue: s.totalRevenue, profit: s.profit }])
        );
        setProjects(
          projectsList.map((p) => ({
            ...p,
            totalCost: summaryMap[p.id]?.totalCost ?? 0,
            totalRevenue: summaryMap[p.id]?.totalRevenue ?? 0,
            profit: (summaryMap[p.id]?.profit ?? 0),
          }))
        );
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    setError(null);
    try {
      await api(`/finance/projects/${confirmDelete.id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Project Costing</h1>
        <Link href="/admin/finance/projects/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          + Add Project
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {projects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No projects yet. Add a project to track costing.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Project</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Revenue</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Profit</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.name}</span>
                      {p.code && <span className="text-gray-500 ml-2">({p.code})</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600">{fmt(p.totalCost)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(p.totalRevenue)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(p.profit)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex gap-3">
                        <Link href={`/admin/finance/projects/${p.id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                          disabled={!!deletingId}
                          className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deletingId && setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Delete project?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <strong>{confirmDelete.name}</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
