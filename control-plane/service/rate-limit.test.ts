import { describe, expect, it, vi } from 'vitest';

import { RateLimiter, resolveRateLimitConfig, resolveRequesterDimension } from './rate-limit.ts';

describe('rate limiter', () => {
  it('allows requests within limit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    const limiter = new RateLimiter(1000);

    const first = limiter.checkAndIncrement('runs:create:unknown', 2);
    const second = limiter.checkAndIncrement('runs:create:unknown', 2);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('rejects requests after exceeding limit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    const limiter = new RateLimiter(1000);

    limiter.checkAndIncrement('runs:create:unknown', 1);
    const exceeded = limiter.checkAndIncrement('runs:create:unknown', 1);

    expect(exceeded.allowed).toBe(false);

    vi.useRealTimers();
  });

  it('resets counter after window boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    const limiter = new RateLimiter(1000);

    limiter.checkAndIncrement('runs:create:unknown', 1);
    const exceeded = limiter.checkAndIncrement('runs:create:unknown', 1);
    vi.advanceTimersByTime(1001);
    const reset = limiter.checkAndIncrement('runs:create:unknown', 1);

    expect(exceeded.allowed).toBe(false);
    expect(reset.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('parses env config deterministically', () => {
    const parsed = resolveRateLimitConfig({
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX_REQUESTS: '10',
      RATE_LIMIT_SLACK_ACTION_MAX: '4',
      RATE_LIMIT_RUN_CREATE_MAX: '3'
    } as NodeJS.ProcessEnv);

    expect(parsed.valid).toBe(true);
    expect(parsed.config).toEqual({
      windowMs: 1000,
      maxRequests: 10,
      slackActionMax: 4,
      runCreateMax: 3
    });
  });

  it('normalizes requester dimension', () => {
    expect(resolveRequesterDimension({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' })).toBe('10.0.0.1');
    expect(resolveRequesterDimension({})).toBe('unknown');
  });
});
