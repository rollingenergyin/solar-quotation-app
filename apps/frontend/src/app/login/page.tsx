'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [emailOrUserId, setEmailOrUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  if (isAuthenticated) {
    router.replace('/');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(emailOrUserId, password, rememberMe);
      router.replace('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      const isNetworkError =
        /load failed|failed to fetch|network error|timeout/i.test(msg);
      setError(isNetworkError ? 'Network error. Please try again.' : msg);
      if (isNetworkError && typeof window !== 'undefined') {
        console.error('LOGIN ERROR:', err);
        alert('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md p-6 md:p-8 border border-gray-200 rounded-lg bg-white shadow-sm">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Sign In</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="emailOrUserId" className="block text-sm font-medium text-gray-700 mb-1">
              Email or User ID
            </label>
            <input
              id="emailOrUserId"
              type="text"
              value={emailOrUserId}
              onChange={(e) => setEmailOrUserId(e.target.value)}
              placeholder="e.g. sales01 or user@example.com"
              required
              autoComplete="username"
              className="w-full text-base p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full text-base p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto py-3 px-6 text-lg font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-6 text-sm text-gray-500">
          <Link href="/" className="text-yellow-600 hover:text-yellow-700 font-medium">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
