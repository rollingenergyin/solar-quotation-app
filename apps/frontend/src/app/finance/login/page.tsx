'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinanceLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="text-gray-500">Redirecting to login…</span>
    </div>
  );
}
