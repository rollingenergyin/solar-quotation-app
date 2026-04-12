'use client';

import { useState, useEffect, useRef } from 'react';
import { attendanceApi, type AttendanceNotification } from '@/lib/attendance-api';

export default function AttendanceNotificationBell() {
  const [notifs, setNotifs] = useState<AttendanceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.readAt).length;

  const load = async () => {
    try {
      const data = await attendanceApi.getNotifications();
      setNotifs(data);
    } catch {
      // silently ignore if unauthenticated
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000); // poll every minute
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleOpen = async () => {
    if (!open && unread > 0) {
      await attendanceApi.markNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    }
    setOpen((v) => !v);
  };

  const ICONS: Record<string, string> = {
    LATE: '⏰',
    CHECKIN_REMINDER: '🔔',
    CHECKOUT_REMINDER: '🔔',
    MISSING: '⚠️',
    LEAVE_DECIDED: '🗓',
    COMPOFF_DECIDED: '☀️',
    WORKFLOW_UPDATE: '📋',
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-900">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet.</div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 ${!n.readAt ? 'bg-yellow-50' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5">{ICONS[n.type] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-yellow-500 mt-1 flex-shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
