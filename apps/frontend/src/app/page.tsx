'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function HomePage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  if (isLoading) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        Loading...
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="text-yellow-500 text-4xl">☀</div>
        <h1 className="text-2xl font-bold text-gray-900">Solar Quotation App</h1>
        <p className="text-gray-500">Sign in to continue</p>
        <Link href="/login" className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-xl">☀</span>
          <h1 className="text-lg font-bold text-gray-900">Solar Quotation App</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.name} · <span className="text-yellow-600 font-medium">{user.role}</span></span>
          <Link href="/sales" className="text-sm bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 transition-colors">Sales Dashboard</Link>
          {(user.role === 'ADMIN' || user.role === 'FINANCE') && (
            <Link href="/finance/dashboard" className="text-sm bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors">Finance Panel</Link>
          )}
          {user.role === 'ADMIN' && (
            <Link href="/admin" className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">Admin Panel</Link>
          )}
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700">Sign out</button>
        </div>
      </header>
      <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
        <p className="text-gray-600">Welcome back, <strong>{user.name}</strong>.</p>
      </div>
    </main>
  );
}
