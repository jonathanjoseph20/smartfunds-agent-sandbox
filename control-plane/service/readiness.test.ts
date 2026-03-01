import { describe, expect, it } from 'vitest';

import { getServiceDb } from './storage/db.ts';
import { evaluateReadiness } from './readiness.ts';

describe('readiness', () => {
  it('fails env check when required keys are missing', () => {
    const db = getServiceDb(':memory:');

    const readiness = evaluateReadiness({
      db,
      env: {
        SLACK_BOT_TOKEN: 'xoxb-1',
        SLACK_DEFAULT_CHANNEL: 'C123',
        SLACK_SIGNING_SECRET: 'secret'
      } as NodeJS.ProcessEnv
    });

    expect(readiness).toEqual({
      ready: false,
      checks: {
        journal: 'ok',
        slackConfig: 'ok',
        rateLimiter: 'ok',
        env: 'missing_keys'
      }
    });
  });

  it('passes all checks when config is complete', () => {
    const db = getServiceDb(':memory:');

    const readiness = evaluateReadiness({
      db,
      env: {
        RATE_LIMIT_WINDOW_MS: '1000',
        RATE_LIMIT_MAX_REQUESTS: '20',
        RATE_LIMIT_SLACK_ACTION_MAX: '10',
        RATE_LIMIT_RUN_CREATE_MAX: '5',
        SLACK_BOT_TOKEN: 'xoxb-1',
        SLACK_DEFAULT_CHANNEL: 'C123',
        SLACK_SIGNING_SECRET: 'secret'
      } as NodeJS.ProcessEnv
    });

    expect(readiness).toEqual({
      ready: true,
      checks: {
        journal: 'ok',
        slackConfig: 'ok',
        rateLimiter: 'ok',
        env: 'ok'
      }
    });
  });
});
