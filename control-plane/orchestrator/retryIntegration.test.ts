import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import type { RawCheck } from './ci/types.ts';
import {
  detectRetryAttemptInEvidence,
  insertRetryAttemptInEvidence,
  runRetryIntegration
} from './retryIntegration.ts';

type RunnerCall = { runner: 'gh' | 'git'; args: string[] };

function runner(
  callLog: RunnerCall[],
  name: 'gh' | 'git',
  failures: Record<string, number> = {}
): (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }> {
  return async (args: string[]) => {
    callLog.push({ runner: name, args: [...args] });
    const key = `${name}:${args.join(' ')}`;
    if (failures[key]) {
      return { code: failures[key], stdout: '', stderr: 'failed' };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
}

function governanceFailureRawCheck(code: string): RawCheck[] {
  return [{
    name: 'governance',
    conclusion: 'FAILURE',
    output: {
      summary: `errorCode: ${code}`
    }
  }];
}

describe('retryIntegration helpers', () => {
  it('detects retry-attempt in evidence block', () => {
    const body = [
      'tier-3',
      '',
      '```evidence',
      'Risk Tier: 3',
      'Justification: x',
      'retry-attempt: 1',
      '```'
    ].join('\n');

    expect(detectRetryAttemptInEvidence(body)).toBe(true);
  });

  it('inserts retry-attempt once deterministically', () => {
    const body = [
      'tier-2',
      '',
      '```evidence',
      'Risk Tier: 2',
      'Justification: x',
      'Affected Paths: x',
      'Tests Added: x',
      'Determinism Statement: x',
      '```'
    ].join('\n');

    const first = insertRetryAttemptInEvidence(body);
    const second = insertRetryAttemptInEvidence(first);
    expect(first).toContain('retry-attempt: 1');
    expect(first).toBe(second);
  });
});

describe('retryIntegration', () => {
  it('returns retry-ineligible for non-governance failures', async () => {
    const calls: RunnerCall[] = [];
    const result = await runRetryIntegration({
      executionMode: 'autonomous',
      ciResult: [{ name: 'unit_tests', conclusion: 'FAILURE' }],
      prNumber: 41,
      currentPrBody: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: x\nAffected Paths: x\nTests Added: x\nDeterminism Statement: x\n```',
      currentLabels: ['tier-2'],
      requiredTier: 2,
      requiredTierLabel: 'tier-2',
      dryRun: false,
      gh: runner(calls, 'gh'),
      git: runner(calls, 'git')
    });

    expect(result.retryAttempted).toBe(false);
    expect(result.retryEligible).toBe(false);
    expect(result.retryReason).toBe('non_governance_governing_failure');
    expect(calls).toEqual([]);
  });

  it('keeps patchId deterministic for identical inputs', async () => {
    const args = {
      executionMode: 'autonomous' as const,
      ciResult: governanceFailureRawCheck('MISSING_EVIDENCE_BLOCK'),
      prNumber: 41,
      currentPrBody: 'tier-3',
      currentLabels: [],
      requiredTier: 3,
      requiredTierLabel: 'tier-3',
      dryRun: true
    };

    const first = await runRetryIntegration({
      ...args,
      gh: runner([], 'gh'),
      git: runner([], 'git')
    });
    const second = await runRetryIntegration({
      ...args,
      gh: runner([], 'gh'),
      git: runner([], 'git')
    });

    expect(first.patchId).toBe(second.patchId);
    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
  });

  it('applies deterministic retry wiring and blocks second retry via PR-body state', async () => {
    const calls: RunnerCall[] = [];
    const writes: Array<{ path: string; body: string }> = [];

    const first = await runRetryIntegration({
      executionMode: 'autonomous',
      ciResult: governanceFailureRawCheck('MISSING_TIER_LABEL'),
      prNumber: 41,
      currentPrBody: 'tier-3\n\nNo evidence yet.',
      currentLabels: [],
      requiredTier: 3,
      requiredTierLabel: 'tier-3',
      dryRun: false,
      gh: runner(calls, 'gh'),
      git: runner(calls, 'git'),
      writeFile: (path, body) => {
        writes.push({ path, body });
      }
    });

    expect(first.retryAttempted).toBe(true);
    expect(first.retryEligible).toBe(true);
    expect(first.retryReason).toBe('retry_applied');
    expect(first.appliedMutations.bodyUpdated).toBe(true);
    expect(first.appliedMutations.labelsUpdated).toBe(true);
    expect(first.metadataRefreshed).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toContain('```evidence');
    expect(writes[0].body).toContain('retry-attempt: 1');
    expect(calls).toContainEqual({
      runner: 'git',
      args: ['commit', '--allow-empty', '-m', 'chore: governance metadata refresh']
    });
    expect(calls).toContainEqual({
      runner: 'git',
      args: ['push']
    });

    const second = await runRetryIntegration({
      executionMode: 'autonomous',
      ciResult: governanceFailureRawCheck('MISSING_TIER_LABEL'),
      prNumber: 41,
      currentPrBody: writes[0].body,
      currentLabels: ['tier-3'],
      requiredTier: 3,
      requiredTierLabel: 'tier-3',
      dryRun: false,
      gh: runner([], 'gh'),
      git: runner([], 'git')
    });

    expect(second.retryAttempted).toBe(false);
    expect(second.retryEligible).toBe(false);
    expect(second.retryReason).toBe('retry_already_consumed');
  });

  it('does not refresh metadata when no mutation occurs', async () => {
    const calls: RunnerCall[] = [];
    const body = [
      'tier-2',
      '',
      '```evidence',
      'Risk Tier: 2',
      'Justification: x',
      'Affected Paths: x',
      'Tests Added: x',
      'Determinism Statement: x',
      'retry-attempt: 1',
      '```'
    ].join('\n');

    const result = await runRetryIntegration({
      executionMode: 'autonomous',
      ciResult: governanceFailureRawCheck('MISSING_EVIDENCE_BLOCK'),
      prNumber: 41,
      currentPrBody: body,
      currentLabels: ['tier-2'],
      requiredTier: 2,
      requiredTierLabel: 'tier-2',
      dryRun: false,
      gh: runner(calls, 'gh'),
      git: runner(calls, 'git')
    });

    expect(result.retryAttempted).toBe(false);
    expect(result.metadataRefreshed).toBe(false);
    expect(calls).toEqual([]);
  });
});
