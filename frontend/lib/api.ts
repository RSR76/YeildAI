const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

// Render Free instances cold-start and re-initialize their forecast index on
// wake, so the first real request after idle can hit a 502 (proxy up,
// process not yet listening) or 503 (listening, index not ready yet) before
// settling. A small bounded retry rides through that window without masking
// a genuinely broken backend.
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4000;

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
}

export interface ApiClientOptions {
  onRetry?: (info: RetryInfo) => void;
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}

export async function apiClient<T>(endpoint: string, params?: Record<string, string>, options?: ApiClientOptions): Promise<T> {
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const query = new URLSearchParams(params).toString();
    url += `?${query}`;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      if (isLastAttempt) {
        throw err instanceof Error ? err : new Error('Network error: could not reach the backend');
      }
      options?.onRetry?.({ attempt, maxAttempts: MAX_ATTEMPTS });
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    if (isRetryableStatus(response.status) && !isLastAttempt) {
      options?.onRetry?.({ attempt, maxAttempts: MAX_ATTEMPTS });
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    // Permanent failures (400, 404, or retries exhausted on 502/503) surface
    // immediately as a normal error — never retried, never silently ignored.
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `API error: ${response.statusText}`);
  }

  // Unreachable: the loop above always returns or throws by the last attempt.
  throw new Error('Network error: could not reach the backend');
}
