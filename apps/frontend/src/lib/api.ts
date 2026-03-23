// Same-domain routing - all API calls are relative
export const API_URL = '/api';
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
  return fetchApi<T>(path, options, token);
}

async function fetchApi<T>(
  path: string,
  options: RequestInit,
  token: string | null
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_URL}${path}`,
      fetchOptions,
      FETCH_TIMEOUT_MS
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out. Is the backend reachable?'
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
