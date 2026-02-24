import { describe, expect, it } from 'vitest';

import { evaluateModePolicy } from './mode-policy';

describe('mode policy', () => {
  it('fails structured mode below tier-2 (T-M6)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['structured'],
      declaredTier: 1
    });

    expect(result.status).toBe('failed');
    expect(result.violation).toBe('structured_min_tier_violation');
    expect(result.requiredMinimumTier).toBe(2);
    expect(result.message).toContain('structured execution mode requires declared tier-2 or tier-3');
    expect(result.nextActions).toEqual(['Raise declared tier to tier-2 or tier-3 and align PR metadata/evidence.']);
  });

  it('passes structured mode at tier-2 (T-M7)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['structured'],
      declaredTier: 2
    });

    expect(result.status).toBe('ok');
    expect(result.violation).toBeNull();
    expect(result.requiredMinimumTier).toBe(2);
  });

  it('passes autonomous-only mode at tier-0 (T-M8)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['autonomous'],
      declaredTier: 0
    });

    expect(result.status).toBe('ok');
    expect(result.violation).toBeNull();
    expect(result.requiredMinimumTier).toBeNull();
  });

  it('fails mixed execution modes (T-M9)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['autonomous', 'structured'],
      declaredTier: 3
    });

    expect(result.status).toBe('failed');
    expect(result.violation).toBe('mixed_execution_modes');
    expect(result.requiredMinimumTier).toBeNull();
    expect(result.message).toContain('mixed execution modes detected');
    expect(result.nextActions).toEqual(['Split changes into separate PRs so each PR uses exactly one execution mode.']);
  });
});
