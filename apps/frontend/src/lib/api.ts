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
    const raw =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out. Is the backend reachable?'
        : err instanceof Error
          ? err.message
          : 'Network error';
    const isConnFail =
      /failed to fetch|load failed|networkerror|econnrefused|connection refused|-102/i.test(raw) ||
      (typeof navigator !== 'undefined' && !navigator.onLine);
    const hint =
      typeof window !== 'undefined' && isConnFail
        ? ' Start the API on port 4000: from the repo root run `npm run dev` (starts Next + backend), or in a second terminal `npm run dev -w backend`. If it still fails, set apps/frontend/.env.local to NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 and restart Next. Avoid `npm run dev:next` alone — it does not start the backend.'
        : '';
    throw new Error(raw + hint);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as {
      error?: string;
      details?: string;
      errors?: Array<{ msg?: string }>;
    };
    const primary =
      data.error ||
      (Array.isArray(data.errors) && data.errors[0] && (data.errors[0].msg ?? String(data.errors[0]))) ||
      res.statusText;
    let msg = [primary, data.details].filter((x) => typeof x === 'string' && x.trim().length > 0).join(' — ');
    if (res.status === 502 && !msg.trim()) {
      msg =
        'Cannot reach the API server. From the repo root run npm run dev (starts frontend and backend), or npm run dev -w backend.';
    }
    throw new Error(msg || res.statusText);
  }

  const text = await res.text();
  if (!text || text.trim() === '') return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid response from server');
  }
}

/** Multipart upload — do not set Content-Type (browser sets boundary). */
export async function apiFormData<T>(path: string, formData: FormData): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: HeadersInit = {};
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_URL}${path}`,
      { method: 'POST', headers, body: formData, credentials: 'include' },
      FETCH_TIMEOUT_MS
    );
  } catch (err) {
    const raw =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out.'
        : err instanceof Error
          ? err.message
          : 'Network error';
    throw new Error(raw);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
    const msg = [data.error, data.details].filter((x) => typeof x === 'string' && x.trim()).join(' — ');
    throw new Error(msg || res.statusText);
  }
  const text = await res.text();
  if (!text || text.trim() === '') return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid response from server');
  }
}
