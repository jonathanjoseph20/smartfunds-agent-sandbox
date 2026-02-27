import fs from 'node:fs';

import type { GovernanceErrorCode } from '../diagnostics.ts';
import type { RetryState } from './types.ts';

export function createInitialRetryState(): RetryState {
  return {
    version: 1,
    prs: {}
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    const stableEntries = entries.map(([key, entryValue]) => [key, stableValue(entryValue)]);
    return Object.fromEntries(stableEntries);
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value), null, 2);
}

export function loadRetryState(filePath: string): RetryState {
  if (!fs.existsSync(filePath)) {
    return createInitialRetryState();
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as RetryState;
  if (parsed.version !== 1 || typeof parsed.prs !== 'object' || parsed.prs === null) {
    throw new Error('Invalid retry state file format.');
  }

  return parsed;
}

export function saveRetryState(filePath: string, state: RetryState): void {
  fs.writeFileSync(filePath, `${stableStringify(state)}\n`);
}

export function getRetryAttempts(state: RetryState, pr: number): number {
  const key = String(pr);
  const entry = state.prs[key];
  return entry?.attempts ?? 0;
}

export function hasReachedRetryLimit(state: RetryState, pr: number): boolean {
  return getRetryAttempts(state, pr) >= 1;
}

export function updateRetryStateForAppliedAction(params: {
  state: RetryState;
  pr: number;
  actionCodes: GovernanceErrorCode[];
  lastCommitSha: string;
}): RetryState {
  const prKey = String(params.pr);
  const sortedCodes = Array.from(new Set(params.actionCodes)).sort((a, b) => a.localeCompare(b));

  return {
    version: 1,
    prs: {
      ...params.state.prs,
      [prKey]: {
        attempts: 1,
        lastActionCodes: sortedCodes,
        lastOutcome: 'applied',
        lastCommitSha: params.lastCommitSha
      }
    }
  };
}

export function buildRetryTriggerContent(pr: number, attempt: number): string {
  return `pr=${pr} attempt=${attempt}`;
}
