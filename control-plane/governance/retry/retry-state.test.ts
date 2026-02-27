import { describe, expect, it } from 'vitest';

import {
  buildRetryTriggerContent,
  createInitialRetryState,
  getRetryAttempts,
  hasReachedRetryLimit,
  stableStringify,
  updateRetryStateForAppliedAction
} from './retry-state.ts';

describe('retry state', () => {
  it('increments attempts from 0 to 1 for first applied retry', () => {
    const initial = createInitialRetryState();
    expect(getRetryAttempts(initial, 40)).toBe(0);

    const updated = updateRetryStateForAppliedAction({
      state: initial,
      pr: 40,
      actionCodes: ['MISSING_EVIDENCE_BLOCK'],
      lastCommitSha: ''
    });

    expect(getRetryAttempts(updated, 40)).toBe(1);
    expect(hasReachedRetryLimit(updated, 40)).toBe(true);
  });

  it('enforces retry limit after first attempt', () => {
    const state = updateRetryStateForAppliedAction({
      state: createInitialRetryState(),
      pr: 7,
      actionCodes: ['MISSING_LABEL'],
      lastCommitSha: ''
    });

    expect(hasReachedRetryLimit(state, 7)).toBe(true);
    expect(getRetryAttempts(state, 7)).toBe(1);
  });

  it('stable stringifies with deterministic key order and sorted action codes', () => {
    const state = updateRetryStateForAppliedAction({
      state: createInitialRetryState(),
      pr: 40,
      actionCodes: ['MISSING_TIER_LABEL', 'MISSING_EVIDENCE_BLOCK', 'MISSING_TIER_LABEL'],
      lastCommitSha: ''
    });

    expect(stableStringify(state)).toBe(`{
  "prs": {
    "40": {
      "attempts": 1,
      "lastActionCodes": [
        "MISSING_EVIDENCE_BLOCK",
        "MISSING_TIER_LABEL"
      ],
      "lastCommitSha": "",
      "lastOutcome": "applied"
    }
  },
  "version": 1
}`);
  });

  it('renders deterministic trigger file content', () => {
    expect(buildRetryTriggerContent(40, 1)).toBe('pr=40 attempt=1');
  });
});
