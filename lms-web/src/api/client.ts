export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** localStorage key of the lms-api JWT (Authorization: Bearer ...). */
export const ACCESS_TOKEN_KEY = 'lms_access_token';
export const REFRESH_TOKEN_KEY = 'lms_refresh_token';

/** Reads are cut short so the UI can fall back to offline content quickly. */
export const READ_TIMEOUT_MS = 3500;
/** Writes may run graders or LLM calls on the backend. */
export const WRITE_TIMEOUT_MS = 30000;

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * Error thrown by apiFetch.
 * - status 0 / isNetworkError: no HTTP response at all (backend offline, CORS, timeout).
 * - status >= 400: the backend answered with an error; `code` and `message` come from its JSON envelope.
 * - status 2xx with code != 0: the backend envelope reported a failure.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly path: string;
  readonly method: string;
  readonly isNetworkError: boolean;

  constructor(params: { message: string; status: number; code?: number | null; path: string; method: string }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code ?? null;
    this.path = params.path;
    this.method = params.method;
    this.isNetworkError = params.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

/** User-facing message for any error thrown by the API layer. */
export function describeApiError(err: unknown): string {
  if (isApiError(err)) {
    if (err.isNetworkError) return 'Không kết nối được máy chủ LMS. Vui lòng kiểm tra kết nối và thử lại.';
    if (err.isUnauthorized) return 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.';
    return err.message || `Yêu cầu thất bại (HTTP ${err.status}).`;
  }
  return err instanceof Error && err.message ? err.message : 'Đã có lỗi không xác định.';
}

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function getAccessToken(): string | null {
  return hasStorage() ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function setAuthTokens(accessToken: string, refreshToken?: string | null): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAuthTokens(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function buildApiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Headers shared by JSON and streaming requests: scope + bearer token when signed in. */
export function buildAuthHeaders(extra?: HeadersInit): Record<string, string> {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    Scope: 'lms-web',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((extra as Record<string, string>) || {}),
  };
}

const isEnvelope = (json: unknown): json is ApiEnvelope<unknown> =>
  Boolean(json) && typeof json === 'object' && 'code' in (json as object) && typeof (json as ApiEnvelope<unknown>).code === 'number';

/** Converts a non-2xx response into an ApiError (and clears the session on 401). */
export async function toHttpError(res: Response, path: string, method: string): Promise<ApiError> {
  let code: number | null = null;
  let message = '';
  try {
    const json: unknown = await res.json();
    if (isEnvelope(json)) {
      code = json.code;
      message = json.message || '';
    }
  } catch {
    // Non-JSON error body (proxy page, empty body)
  }
  if (res.status === 401) clearAuthTokens();
  return new ApiError({
    status: res.status,
    code,
    message: message || `Yêu cầu ${method} ${path} thất bại (HTTP ${res.status}).`,
    path,
    method,
  });
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * Allows `fallback` for a non-read request. Only for requests whose fallback is an honest
   * "unknown/not saved" value, never a fabricated success.
   */
  allowMockFallback?: boolean;
  timeoutMs?: number;
}

/**
 * Calls lms-api and unwraps the `{code, message, data}` envelope.
 *
 * `fallback` (offline demo content) is returned only when no HTTP response was received AND the
 * request is a read (GET/HEAD) or explicitly opts in with `allowMockFallback`. Every HTTP error and every
 * failed write throws an ApiError, so the UI can never show a fake success.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  fallback?: T | (() => T | Promise<T>),
): Promise<T> {
  const { allowMockFallback, timeoutMs, headers: extraHeaders, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const url = buildApiUrl(path);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? (isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS));
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method,
      headers: buildAuthHeaders(extraHeaders),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    if (fallback !== undefined && (isRead || allowMockFallback)) {
      return typeof fallback === 'function' ? await (fallback as () => T | Promise<T>)() : fallback;
    }
    throw new ApiError({
      status: 0,
      message: `Không kết nối được máy chủ (${method} ${path}).`,
      path,
      method,
    });
  }
  clearTimeout(timer);

  if (!res.ok) throw await toHttpError(res, path, method);
  if (res.status === 204) return undefined as T;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError({
      status: res.status,
      message: `Máy chủ trả về dữ liệu không hợp lệ (${method} ${path}).`,
      path,
      method,
    });
  }

  if (isEnvelope(json)) {
    if (json.code !== 0) {
      throw new ApiError({
        status: res.status,
        code: json.code,
        message: json.message || `Yêu cầu ${method} ${path} thất bại (code ${json.code}).`,
        path,
        method,
      });
    }
    return json.data as T;
  }
  return json as T;
}
