const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const TOKEN_STORAGE_KEY = 'yieldai_auth_token';

/** Reads the stored JWT, if any. Safe to call on the server (returns null). */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return data.error || data.message || `API error: ${response.statusText}`;
}

/**
 * GET helper, kept backward-compatible with existing call sites that pass
 * query params as the second argument. Automatically attaches the stored
 * auth token (if any) so it also works for authenticated GET endpoints.
 */
export async function apiClient<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const query = new URLSearchParams(params).toString();
    url += `?${query}`;
  }

  const response = await fetch(url, { headers: { ...authHeaders() } });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json();
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the stored auth token as a Bearer header. Defaults to true. */
  auth?: boolean;
}

/**
 * General-purpose request helper for POST/PATCH/DELETE calls (auth,
 * farm-profile CRUD, etc.), with optional auth header injection.
 */
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? authHeaders() : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}