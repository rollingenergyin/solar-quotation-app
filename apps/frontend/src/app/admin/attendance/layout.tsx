'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

const navItems = [
  { href: '/admin/attendance', label: 'Daily View', icon: '📊' },
  { href: '/admin/attendance/leaves', label: 'Leaves', icon: '🗓' },
  { href: '/admin/attendance/compoff', label: 'Comp Off', icon: '☀' },
  { href: '/admin/attendance/workflow', label: 'Requests', icon: '📋' },
  { href: '/admin/attendance/policy', label: 'Policy', icon: '⚙' },
];

export default function AdminAttendanceLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><span className="text-gray-500">Loading…</span></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div>
          <div className="font-semibold text-sm">Attendance Admin</div>
          <div className="text-xs text-gray-400">Rolling Energy</div>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/attendance" className="text-xs text-yellow-400 hover:text-yellow-300">My Attendance</Link>
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-300">← Admin</Link>
        </div>
      </header>

      <SubNav />

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function SubNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b border-gray-200 flex overflow-x-auto scrollbar-none">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/admin/attendance' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              active ? 'text-yellow-600 border-yellow-500' : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
