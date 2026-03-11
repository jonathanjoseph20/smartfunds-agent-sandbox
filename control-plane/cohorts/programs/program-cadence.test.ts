import { describe, expect, it } from 'vitest';

import { evaluateProgramCadence } from './program-cadence.ts';
import type { CohortProgramDefinition } from './program-types.ts';

function definition(cadence: CohortProgramDefinition['cadence']): CohortProgramDefinition {
  return {
    programId: `program-${cadence}`,
    cohortId: 'aave-risk',
    displayName: `Program ${cadence}`,
    cadence,
    enabled: true,
    lifecycleState: 'active',
    investigationTemplates: ['protocol-risk-investigation'],
    launchConditions: [{ kind: 'cadence' }]
  };
}

describe('cohort program cadence evaluation', () => {
  it('T-CP-CAD1 hourly cadence is due for a new slot and stable per slot', () => {
    const program = definition('hourly');
    const now = new Date('2026-03-11T13:42:00.000Z');

    const first = evaluateProgramCadence({
      program,
      now,
      historyEntries: []
    });
    const second = evaluateProgramCadence({
      program,
      now,
      historyEntries: []
    });

    expect(first.currentSlot).toBe('interval_hours:1:2026-03-11T13:00Z');
    expect(first.cadenceDue).toBe(true);
    expect(second).toEqual(first);
  });

  it('T-CP-CAD2 daily cadence is not due when slot already executed', () => {
    const program = definition('daily');

    const evaluated = evaluateProgramCadence({
      program,
      now: new Date('2026-03-11T20:00:00.000Z'),
      historyEntries: [{
        evaluatedSlot: 'daily:2026-03-11',
        logDate: '2026-03-11',
        lifecycleState: 'active',
        matchedConditionKinds: ['cadence'],
        launches: []
      }]
    });

    expect(evaluated.currentSlot).toBe('daily:2026-03-11');
    expect(evaluated.cadenceDue).toBe(false);
    expect(evaluated.cadenceReason).toBe('already_executed_for_slot');
  });

  it('T-CP-CAD3 weekly cadence resolves deterministic monday slot', () => {
    const program = definition('weekly');

    const evaluated = evaluateProgramCadence({
      program,
      now: new Date('2026-03-11T20:00:00.000Z'),
      historyEntries: []
    });

    expect(evaluated.currentSlot).toBe('weekly:2026-03-09');
    expect(evaluated.cadenceDue).toBe(true);
  });

  it('T-CP-CAD4 signal_driven cadence is never due from cadence alone', () => {
    const program = definition('signal_driven');

    const evaluated = evaluateProgramCadence({
      program,
      now: new Date('2026-03-11T20:00:00.000Z'),
      historyEntries: []
    });

    expect(evaluated.cadenceDue).toBe(false);
    expect(evaluated.cadenceReason).toBe('signal_driven_cadence');
  });
});
