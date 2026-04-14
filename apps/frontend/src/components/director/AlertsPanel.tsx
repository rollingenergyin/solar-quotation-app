'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Alert = {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  count?: number;
  link?: string;
};

const SEVERITY_STYLE: Record<Alert['severity'], { bar: string; icon: string; bg: string }> = {
  high:   { bar: 'bg-red-500',    icon: '🔴', bg: 'hover:bg-red-50' },
  medium: { bar: 'bg-orange-400', icon: '🟠', bg: 'hover:bg-orange-50' },
  low:    { bar: 'bg-blue-400',   icon: '🔵', bg: 'hover:bg-blue-50' },
};

export default function AlertsPanel() {
  const { data, isLoading } = useQuery<{ alerts: Alert[] }>({
    queryKey: ['dashboard', 'alerts'],
    queryFn: () => api<{ alerts: Alert[] }>('/dashboard/alerts'),
    refetchInterval: 60_000,
  });

  const alerts = data?.alerts ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Alerts</h2>
        {alerts.length > 0 && (
          <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-gray-400 gap-1">
          <span className="text-2xl">✅</span>
          <span>All clear — no active alerts</span>
        </div>
      )}

      {!isLoading && alerts.length > 0 && (
        <ul className="space-y-2 overflow-y-auto flex-1">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            const inner = (
              <div className={`flex items-start gap-3 p-3 rounded-xl border border-transparent transition-colors cursor-default ${style.bg}`}>
                <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${style.bar}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{alert.message}</p>
                  {alert.link && (
                    <span className="text-xs text-gray-400 mt-0.5 block">Tap to view →</span>
                  )}
                </div>
                <span className="text-base flex-shrink-0">{style.icon}</span>
              </div>
            );
            return (
              <li key={alert.type}>
                {alert.link ? <Link href={alert.link}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
