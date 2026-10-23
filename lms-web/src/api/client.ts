const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  fallback?: T | (() => T | Promise<T>),
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('lms_access_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Scope: 'lms-web',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json()) as ApiEnvelope<T> | T;
      if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
        return (json as ApiEnvelope<T>).data;
      }
      return json as T;
    }
  } catch {
    // Resilient fallback when backend is offline or running standalone
  }

  if (fallback !== undefined) {
    return typeof fallback === 'function' ? await (fallback as () => T | Promise<T>)() : fallback;
  }

  throw new Error(`API request failed for ${path}`);
}
