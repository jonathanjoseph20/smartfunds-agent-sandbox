import { describe, expect, it } from 'vitest';

import { mutationKernel } from './mutationKernel.ts';

function countOccurrences(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
}

describe('mutationKernel', () => {
  it('is idempotent for identical semantic input (A)', () => {
    const input = {
      currentBody: 'tier-1\n\n```evidence\nRisk Tier: 1\nJustification: x\n```\n',
      currentLabels: ['tier-1', 'codex', 'tier-1'],
      desiredTier: 'tier-1',
      retryAttempt: 1,
      allowedLabelMutations: ['tier-0', 'tier-1', 'tier-2', 'tier-3']
    };

    const first = mutationKernel(input);
    const second = mutationKernel({
      ...input,
      currentBody: first.newBody,
      currentLabels: first.newLabels
    });

    expect(second.newBody).toBe(first.newBody);
    expect(second.newLabels).toEqual(first.newLabels);
    expect(second.deterministicHash).toBe(first.deterministicHash);
  });

  it('deduplicates evidence blocks into one canonical block (B)', () => {
    const body = [
      'tier-2',
      '',
      '```evidence',
      'Risk Tier: 2',
      'Justification: first',
      '```',
      '',
      'notes',
      '',
      '```evidence',
      'Risk Tier: 2',
      'Tests Added: second',
      '```'
    ].join('\n');

    const result = mutationKernel({
      currentBody: body,
      currentLabels: ['tier-2']
    });

    expect(countOccurrences(result.newBody, /^```evidence$/gm)).toBe(1);
    expect(countOccurrences(result.newBody, /^```$/gm)).toBe(1);
  });

  it('deduplicates tier lines and keeps one canonical top line (C)', () => {
    const body = [
      'tier-1',
      '',
      'notes',
      'tier-3',
      '',
      '```evidence',
      'Risk Tier: 1',
      'Justification: x',
      '```'
    ].join('\n');

    const result = mutationKernel({
      currentBody: body,
      currentLabels: ['tier-1']
    });

    expect(result.newBody.startsWith('tier-3\n')).toBe(true);
    expect(countOccurrences(result.newBody, /^tier-[0-3]$/gm)).toBe(1);
  });

  it('updates and removes retry-attempt deterministically (D)', () => {
    const body = [
      'tier-2',
      '',
      '```evidence',
      'Risk Tier: 2',
      'Justification: x',
      'retry-attempt: 1',
      '```'
    ].join('\n');

    const updated = mutationKernel({
      currentBody: body,
      currentLabels: ['tier-2'],
      retryAttempt: 2
    });

    expect(updated.newBody).toContain('retry-attempt: 2');
    expect(countOccurrences(updated.newBody, /^retry-attempt:/gm)).toBe(1);

    const removed = mutationKernel({
      currentBody: updated.newBody,
      currentLabels: ['tier-2'],
      retryAttempt: null
    });

    expect(removed.newBody.includes('retry-attempt:')).toBe(false);
  });

  it('deduplicates/sorts labels and mutates only within allowed scope (E)', () => {
    const result = mutationKernel({
      currentBody: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: x\n```',
      currentLabels: ['zzz', 'tier-1', 'aaa', 'tier-2', 'tier-2'],
      desiredTier: 'tier-3',
      allowedLabelMutations: ['tier-1', 'tier-2', 'tier-3']
    });

    expect(result.newLabels).toEqual(['aaa', 'tier-3', 'zzz']);
  });

  it('sets requiresMetadataRefresh only from body/labels changed (F)', () => {
    const canonicalBody = [
      'tier-2',
      '',
      '```evidence',
      'Risk Tier: 2',
      'Justification: x',
      'Affected Paths: y',
      'Tests Added: z',
      'Determinism Statement: d',
      '```'
    ].join('\n');

    const noChange = mutationKernel({
      currentBody: canonicalBody,
      currentLabels: ['tier-2'],
      desiredTier: 'tier-2',
      allowedLabelMutations: ['tier-2']
    });
    expect(noChange.bodyChanged).toBe(false);
    expect(noChange.labelsChanged).toBe(false);
    expect(noChange.requiresMetadataRefresh).toBe(false);

    const bodyChanged = mutationKernel({
      currentBody: 'tier-2',
      currentLabels: ['tier-2'],
      desiredTier: 'tier-2',
      allowedLabelMutations: ['tier-2']
    });
    expect(bodyChanged.bodyChanged).toBe(true);
    expect(bodyChanged.requiresMetadataRefresh).toBe(true);

    const labelsChanged = mutationKernel({
      currentBody: canonicalBody,
      currentLabels: ['tier-1'],
      desiredTier: 'tier-2',
      allowedLabelMutations: ['tier-1', 'tier-2']
    });
    expect(labelsChanged.labelsChanged).toBe(true);
    expect(labelsChanged.requiresMetadataRefresh).toBe(true);
  });

  it('keeps deterministic hash stable for equivalent semantics (G)', () => {
    const first = mutationKernel({
      currentBody: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: x\n```\n',
      currentLabels: ['tier-2', 'codex'],
      desiredTier: 'tier-2',
      allowedLabelMutations: ['tier-2']
    });

    const second = mutationKernel({
      currentBody: 'tier-1\n\ntier-2\n\n```evidence\nJustification: x\nRisk Tier: 2\n```',
      currentLabels: ['codex', 'tier-2', 'tier-2'],
      desiredTier: 'tier-2',
      allowedLabelMutations: ['tier-2']
    });

    expect(second.newBody).toBe(first.newBody);
    expect(second.newLabels).toEqual(first.newLabels);
    expect(second.deterministicHash).toBe(first.deterministicHash);
  });
});
