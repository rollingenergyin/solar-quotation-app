'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import FinanceSidebar from '@/components/FinanceSidebar';

/** Prefer Next pathname; if missing (hydration quirks), read window every render so route never stays blank */
function useResolvedPathname(): string {
  const pathname = usePathname();
  if (pathname && pathname.length > 0) return pathname;
  if (typeof window !== 'undefined') return window.location.pathname;
  return '';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const routePath = useResolvedPathname();
  const isFinanceRoute = routePath.startsWith('/admin/finance');

  const hasAdminAccess = isAuthenticated && user?.role === 'ADMIN';
  const hasFinanceAccess = isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'FINANCE');
  const allowed = hasAdminAccess || (isFinanceRoute && hasFinanceAccess);
  const showFinanceSidebar = isFinanceRoute && (user?.role === 'ADMIN' || user?.role === 'FINANCE');

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace('/login');
    }
  }, [isLoading, allowed, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500">Loading…</span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-gray-50 px-4 text-center">
        <span className="text-gray-600">You don&apos;t have access to this area.</span>
        <span className="text-sm text-gray-500">Redirecting to login…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 lg:flex-row flex-col">
      {showFinanceSidebar ? <FinanceSidebar /> : <AdminSidebar />}
      <main className={`flex-1 overflow-auto ${showFinanceSidebar ? 'finance-main pt-16 lg:pt-0' : 'pt-16 md:pt-0 min-w-0'}`}>{children}</main>
    </div>
  );
}
