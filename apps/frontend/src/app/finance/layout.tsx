'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import FinanceSidebar from '@/components/FinanceSidebar';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'FINANCE'))) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'FINANCE')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 lg:flex-row flex-col">
      <FinanceSidebar />
      <main className="flex-1 overflow-auto pt-16 lg:pt-0 finance-main">{children}</main>
    </div>
  );
}
