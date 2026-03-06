import { describe, expect, it } from 'vitest';

import {
  getNextPhase,
  getOrderedPhases,
  isTerminalPhase,
  isValidPhaseTransition,
  validatePhaseSequence
} from './phase-engine.ts';

describe('phase-engine', () => {
  it('returns deterministic canonical phase order', () => {
    expect(getOrderedPhases()).toEqual(['plan', 'setup', 'implement', 'verify', 'test', 'release']);
  });

  it('supports only sequential valid transitions', () => {
    expect(isValidPhaseTransition(null, 'plan')).toBe(true);
    expect(isValidPhaseTransition('plan', 'setup')).toBe(true);
    expect(isValidPhaseTransition('verify', 'test')).toBe(true);
  });

  it('rejects skipped transitions', () => {
    expect(isValidPhaseTransition('plan', 'implement')).toBe(false);
  });

  it('rejects reverse transitions', () => {
    expect(isValidPhaseTransition('setup', 'plan')).toBe(false);
  });

  it('detects duplicate phases as invalid sequence', () => {
    const result = validatePhaseSequence(['plan', 'setup', 'setup', 'implement']);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Duplicate phase: setup'))).toBe(true);
  });

  it('marks release as terminal and returns null next phase', () => {
    expect(isTerminalPhase('release')).toBe(true);
    expect(getNextPhase('release')).toBe(null);
  });

  it('validates canonical full sequence', () => {
    const result = validatePhaseSequence(['plan', 'setup', 'implement', 'verify', 'test', 'release']);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
