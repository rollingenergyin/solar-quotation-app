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
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          padding: '2rem',
          border: '1px solid #e5e5e5',
          borderRadius: 8,
        }}
      >
        <h1 style={{ marginBottom: '1.5rem' }}>Sign In</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="emailOrUserId" style={{ display: 'block', marginBottom: 4 }}>
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
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </div>
          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span style={{ fontSize: 14 }}>Remember me</span>
          </label>
          {error && (
            <p style={{ color: 'red', fontSize: 14 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: 14 }}>
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
