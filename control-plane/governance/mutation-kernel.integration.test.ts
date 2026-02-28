import { describe, expect, it } from 'vitest';

import { mutationKernel } from '../pr/mutationKernel.ts';

function countOccurrences(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
}

describe('mutation kernel governance integration', () => {
  it('reconstructs broken PR body into canonical format (Scenario 1)', () => {
    const broken = [
      'Context line',
      '',
      '```evidence',
      'Justification: because',
      '```',
      '',
      'tier-1',
      'tier-3'
    ].join('\n');

    const result = mutationKernel({
      currentBody: broken,
      currentLabels: ['codex'],
      desiredTier: 'tier-2',
      allowedLabelMutations: ['tier-0', 'tier-1', 'tier-2', 'tier-3']
    });

    expect(result.newBody.startsWith('tier-2\n\n```evidence\n')).toBe(true);
    expect(result.newBody).toContain('Risk Tier: 2');
    expect(result.newBody).toContain('Justification: because');
    expect(result.newBody).toContain('Affected Paths: N/A');
    expect(result.newBody).toContain('Tests Added: N/A');
    expect(result.newBody).toContain('Determinism Statement: N/A');
    expect(countOccurrences(result.newBody, /^tier-[0-3]$/gm)).toBe(1);
    expect(countOccurrences(result.newBody, /^```evidence$/gm)).toBe(1);
  });

  it('does not duplicate retry-attempt for repeated same attempt (Scenario 2)', () => {
    const first = mutationKernel({
      currentBody: 'tier-3\n\nNo evidence yet.',
      currentLabels: ['tier-3'],
      desiredTier: 'tier-3',
      retryAttempt: 1,
      allowedLabelMutations: ['tier-3']
    });

    const second = mutationKernel({
      currentBody: first.newBody,
      currentLabels: first.newLabels,
      desiredTier: 'tier-3',
      retryAttempt: 1,
      allowedLabelMutations: ['tier-3']
    });

    expect(countOccurrences(second.newBody, /^retry-attempt:\s*1$/gm)).toBe(1);
  });

  it('returns no-op change flags on stable rerun (Scenario 3)', () => {
    const first = mutationKernel({
      currentBody: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: x\n```',
      currentLabels: ['tier-2', 'codex']
    });

    const rerun = mutationKernel({
      currentBody: first.newBody,
      currentLabels: first.newLabels
    });

    expect(rerun.bodyChanged).toBe(false);
    expect(rerun.labelsChanged).toBe(false);
    expect(rerun.requiresMetadataRefresh).toBe(false);
  });
});
