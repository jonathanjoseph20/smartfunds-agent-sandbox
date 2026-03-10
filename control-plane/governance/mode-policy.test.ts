import { describe, expect, it } from 'vitest';

import { evaluateModePolicy } from './mode-policy';

describe('mode policy', () => {
  it('passes structured-only mode (T-M7)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['structured']
    });

    expect(result.status).toBe('ok');
    expect(result.violation).toBeNull();
    expect(result.requiredMinimumTier).toBeNull();
  });

  it('passes autonomous-only mode (T-M8)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['autonomous']
    });

    expect(result.status).toBe('ok');
    expect(result.violation).toBeNull();
    expect(result.requiredMinimumTier).toBeNull();
  });

  it('fails mixed execution modes (T-M9)', () => {
    const result = evaluateModePolicy({
      executionModesTouched: ['autonomous', 'structured']
    });

    expect(result.status).toBe('failed');
    expect(result.violation).toBe('mixed_execution_modes');
    expect(result.requiredMinimumTier).toBeNull();
    expect(result.message).toContain('mixed execution modes detected');
    expect(result.nextActions).toEqual(['Split changes into separate PRs so each PR uses exactly one execution mode.']);
  });
});
