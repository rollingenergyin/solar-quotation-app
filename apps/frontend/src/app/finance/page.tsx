'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinancePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/finance/dashboard');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <span className="text-gray-500">Redirecting…</span>
    </div>
  );
}
