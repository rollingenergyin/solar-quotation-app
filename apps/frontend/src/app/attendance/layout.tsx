'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AttendanceNotificationBell from '@/components/AttendanceNotificationBell';

const navItems = [
  { href: '/attendance', label: 'Check In/Out', icon: '⏱' },
  { href: '/attendance/history', label: 'My History', icon: '📅' },
  { href: '/attendance/leave', label: 'Leave', icon: '🗓' },
  { href: '/attendance/workflow', label: 'Requests', icon: '📋' },
];

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><span className="text-gray-500">Loading…</span></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AttendanceHeader />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}

function AttendanceHeader() {
  const { user, logout } = useAuth();
  return (
    <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div>
        <div className="font-semibold text-sm">Rolling Energy</div>
        <div className="text-xs text-gray-400">{user?.name}</div>
      </div>
      <div className="flex items-center gap-2">
        <AttendanceNotificationBell />
        <Link href="/admin/attendance" className="text-xs text-yellow-400 hover:text-yellow-300">Admin</Link>
        <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-300">Dashboard</Link>
        <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">Sign out</button>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-30">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/attendance' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 text-xs gap-0.5 transition-colors ${
              active ? 'text-yellow-600 font-semibold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
