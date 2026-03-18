'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import RollingEnergyLogo from '@/components/quotation/RollingEnergyLogo';

interface Stats {
  materials: number;
  formulas: number;
  recent: { id: string; action: string; entity: string; createdAt: string; user: { name: string } }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      api<unknown[]>('/materials'),
      api<unknown[]>('/formulas'),
      api<{ logs: Stats['recent'] }>('/audit?limit=5'),
    ]).then(([mats, fmls, audit]) => {
      setStats({
        materials: (mats as unknown[]).length,
        formulas: (fmls as unknown[]).length,
        recent: audit.logs,
      });
    }).catch(() => {});
  }, []);

  const cards = [
    { label: 'Materials', value: stats?.materials ?? '—', color: 'bg-blue-500' },
    { label: 'Formulas', value: stats?.formulas ?? '—', color: 'bg-yellow-500' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-6">
        <RollingEnergyLogo variant="light" size="md" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Rolling Energy — Manage materials, formulas, and templates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-md">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className={`w-8 h-8 rounded-lg ${c.color} mb-3`} />
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
        {stats?.recent.length === 0 && <p className="text-sm text-gray-400">No activity yet.</p>}
        <ul className="divide-y divide-gray-50">
          {stats?.recent.map((log) => (
            <li key={log.id} className="py-3 flex justify-between">
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                  log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>{log.action}</span>
                <span className="ml-2 text-sm text-gray-700 capitalize">{log.entity}</span>
                <span className="ml-2 text-xs text-gray-400">by {log.user?.name}</span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(log.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
