// Base URL must include /api - backend routes are under /api
const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const API_URL = RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE.replace(/\/$/, '')}/api`;
const FETCH_TIMEOUT_MS = 15000;

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_URL}${path}`,
      { ...options, headers },
      FETCH_TIMEOUT_MS
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? `Request timed out. Is the backend running at ${API_URL.replace('/api', '')}?`
        : err instanceof Error
          ? err.message
          : 'Network error';
    throw new Error(msg);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string; errors?: Array<{ msg?: string }> };
    const msg =
      data.error ||
      (Array.isArray(data.errors) && data.errors[0] && (data.errors[0].msg ?? String(data.errors[0]))) ||
      res.statusText;
    throw new Error(msg);
  }

  const text = await res.text();
  if (!text || text.trim() === '') return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid response from server');
  }
}
