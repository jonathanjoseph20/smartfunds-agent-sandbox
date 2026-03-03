export const GITHUB_RETRY_STATUS_CODES = new Set([500, 502, 503, 504]);
export const GITHUB_FAIL_FAST_STATUS_CODES = new Set([401, 403, 404]);

export type GitHubRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number): boolean {
  return GITHUB_RETRY_STATUS_CODES.has(status);
}

function isFailFastStatus(status: number): boolean {
  return GITHUB_FAIL_FAST_STATUS_CODES.has(status);
}

export async function fetchWithGitHubRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  options: GitHubRetryOptions = {}
): Promise<Response> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchImpl(url, init);
    if (response.ok) {
      return response;
    }

    if (isFailFastStatus(response.status)) {
      return response;
    }

    if (!isRetryableStatus(response.status) || attempt === retries) {
      return response;
    }

    const delayMs = baseDelayMs * (2 ** attempt);
    await sleep(delayMs);
  }

  throw new Error('Unreachable retry state.');
}
