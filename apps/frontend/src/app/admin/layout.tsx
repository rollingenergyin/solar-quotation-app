'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import FinanceSidebar from '@/components/FinanceSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isFinanceRoute = pathname?.startsWith('/admin/finance');

  const hasAdminAccess = isAuthenticated && user?.role === 'ADMIN';
  const hasFinanceAccess = isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'FINANCE');
  const allowed = hasAdminAccess || (isFinanceRoute && hasFinanceAccess);
  const showFinanceSidebar = isFinanceRoute && (user?.role === 'ADMIN' || user?.role === 'FINANCE');

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace(isFinanceRoute ? '/login' : '/login');
    }
  }, [isLoading, allowed, isFinanceRoute, router]);

  if (isLoading || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500">Loading…</span>
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
