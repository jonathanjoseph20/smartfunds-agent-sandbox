interface CounterState {
  windowStartMs: number;
  count: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  count: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  slackActionMax: number;
  runCreateMax: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 120,
  slackActionMax: 60,
  runCreateMax: 30
};

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function resolveRateLimitConfig(env: NodeJS.ProcessEnv): {
  config: RateLimitConfig;
  valid: boolean;
  missingOrInvalidKeys: string[];
} {
  const requiredKeys = [
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'RATE_LIMIT_SLACK_ACTION_MAX',
    'RATE_LIMIT_RUN_CREATE_MAX'
  ] as const;

  const parsedWindow = parsePositiveInteger(env.RATE_LIMIT_WINDOW_MS);
  const parsedMax = parsePositiveInteger(env.RATE_LIMIT_MAX_REQUESTS);
  const parsedSlackActionMax = parsePositiveInteger(env.RATE_LIMIT_SLACK_ACTION_MAX);
  const parsedRunCreateMax = parsePositiveInteger(env.RATE_LIMIT_RUN_CREATE_MAX);

  const missingOrInvalidKeys = requiredKeys.filter((key) => parsePositiveInteger(env[key]) === null);

  return {
    config: {
      windowMs: parsedWindow ?? DEFAULT_RATE_LIMIT_CONFIG.windowMs,
      maxRequests: parsedMax ?? DEFAULT_RATE_LIMIT_CONFIG.maxRequests,
      slackActionMax: parsedSlackActionMax ?? (parsedMax ?? DEFAULT_RATE_LIMIT_CONFIG.slackActionMax),
      runCreateMax: parsedRunCreateMax ?? (parsedMax ?? DEFAULT_RATE_LIMIT_CONFIG.runCreateMax)
    },
    valid: missingOrInvalidKeys.length === 0,
    missingOrInvalidKeys
  };
}

export class RateLimiter {
  private readonly counters = new Map<string, CounterState>();

  public constructor(
    private readonly windowMs: number,
    private readonly nowMs: () => number = () => Date.now()
  ) {}

  public checkAndIncrement(key: string, limit: number): RateLimitCheckResult {
    const now = this.nowMs();
    const current = this.counters.get(key);

    if (!current) {
      this.counters.set(key, {
        windowStartMs: now,
        count: 1
      });
      return { allowed: true, count: 1 };
    }

    if ((now - current.windowStartMs) >= this.windowMs) {
      current.windowStartMs = now;
      current.count = 0;
    }

    current.count += 1;
    this.counters.set(key, current);

    return {
      allowed: current.count <= limit,
      count: current.count
    };
  }
}

export const RATE_LIMIT_EXCEEDED_RESPONSE = {
  error: 'rate_limited',
  reasonCode: 'RATE_LIMIT_EXCEEDED'
} as const;

export function resolveRequesterDimension(headers: Record<string, string | undefined> | undefined): string {
  if (!headers) {
    return 'unknown';
  }

  const forwarded = headers['x-forwarded-for'] ?? headers['X-Forwarded-For'];
  if (!forwarded || forwarded.trim().length === 0) {
    return 'unknown';
  }

  const first = forwarded.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}
