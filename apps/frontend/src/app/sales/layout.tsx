'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import SalesSidebar from '@/components/SalesSidebar';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="text-gray-400">Loading…</span></div>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SalesSidebar />
      <main className="flex-1 overflow-auto pt-16 md:pt-0 min-w-0">{children}</main>
    </div>
  );
}
