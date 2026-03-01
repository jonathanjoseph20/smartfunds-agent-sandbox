import type { DatabaseSync } from 'node:sqlite';

import { resolveRateLimitConfig } from './rate-limit.ts';

export interface ServiceReadiness {
  ready: boolean;
  checks: {
    journal: 'ok' | 'fail';
    slackConfig: 'ok' | 'missing';
    rateLimiter: 'ok';
    env: 'ok' | 'missing_keys';
  };
}

function resolveSlackEnabled(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    (env.SLACK_BOT_TOKEN && env.SLACK_BOT_TOKEN.trim().length > 0) ||
    (env.SLACK_WEBHOOK_URL && env.SLACK_WEBHOOK_URL.trim().length > 0) ||
    (env.SLACK_SIGNING_SECRET && env.SLACK_SIGNING_SECRET.trim().length > 0)
  );
}

function resolveSlackConfigStatus(env: NodeJS.ProcessEnv): 'ok' | 'missing' {
  const slackEnabled = resolveSlackEnabled(env);
  if (!slackEnabled) {
    return 'ok';
  }

  const hasSigningSecret = Boolean(env.SLACK_SIGNING_SECRET && env.SLACK_SIGNING_SECRET.trim().length > 0);
  const hasPostingConfig = Boolean(
    (env.SLACK_BOT_TOKEN && env.SLACK_BOT_TOKEN.trim().length > 0 && env.SLACK_DEFAULT_CHANNEL && env.SLACK_DEFAULT_CHANNEL.trim().length > 0) ||
    (env.SLACK_WEBHOOK_URL && env.SLACK_WEBHOOK_URL.trim().length > 0)
  );

  return hasSigningSecret && hasPostingConfig ? 'ok' : 'missing';
}

function resolveJournalStatus(db: DatabaseSync): 'ok' | 'fail' {
  try {
    db.prepare('SELECT 1 AS ok').get();
    return 'ok';
  } catch {
    return 'fail';
  }
}

export function evaluateReadiness(input: {
  db: DatabaseSync;
  env: NodeJS.ProcessEnv;
}): ServiceReadiness {
  const journal = resolveJournalStatus(input.db);
  const slackConfig = resolveSlackConfigStatus(input.env);
  const rateLimitResolution = resolveRateLimitConfig(input.env);
  const env = rateLimitResolution.valid ? 'ok' : 'missing_keys';

  return {
    ready: journal === 'ok' && slackConfig === 'ok' && env === 'ok',
    checks: {
      journal,
      slackConfig,
      rateLimiter: 'ok',
      env
    }
  };
}
