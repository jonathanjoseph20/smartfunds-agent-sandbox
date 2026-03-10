import { describe, expect, it } from 'vitest';

import {
  assertLegalTransition,
  classifyPhaseFailure,
  computeNextEligibleSlot,
  evaluateDue,
  maxRetriesForPhase,
} from './investigation-lifecycle.ts';
import { InvestigationAwaitingDataError } from './investigation-types.ts';

describe('investigation lifecycle', () => {
  it('T-INV-L1 allows valid transitions and rejects invalid transitions', () => {
    expect(() => assertLegalTransition('pending', 'running')).not.toThrow();
    expect(() => assertLegalTransition('running', 'retry_pending')).not.toThrow();
    expect(() => assertLegalTransition('completed', 'running')).toThrow('INVESTIGATION_INVALID_TRANSITION');
  });

  it('T-INV-L2 computes deterministic scheduled resume slots', () => {
    expect(computeNextEligibleSlot({ currentSlotId: 'daily:2026-03-10', delaySlots: 1 })).toBe('daily:2026-03-11');
    expect(computeNextEligibleSlot({ currentSlotId: 'interval_hours:6:2026-03-10T12:00Z', delaySlots: 2 })).toBe('interval_hours:6:2026-03-11T00:00Z');
  });

  it('T-INV-L3 evaluates due state with waiting and slot gating', () => {
    const base = {
      investigationRunId: 'run-1',
      dedupeKey: 'd',
      investigationDefinitionId: 'x',
      sourceSignalReference: 's',
      sourceSignalType: 'liquidity_drain',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      logDate: '2026-03-10',
      status: 'scheduled_resume' as const,
      currentPhaseId: 'gather',
      nextEligibleSlot: 'interval_hours:6:2026-03-10T18:00Z',
      completedPhaseIds: ['intake'],
      artifactPaths: [],
      associatedMissionReferences: [],
      findings: [],
      retryCountByPhase: {}
    };

    expect(evaluateDue({
      record: base,
      currentSlotId: 'interval_hours:6:2026-03-10T12:00Z',
      phaseExists: true,
      alreadyAdvancedForSlot: false,
      dataConditionSatisfied: true
    })).toBe('not_due');

    expect(evaluateDue({
      record: base,
      currentSlotId: 'interval_hours:6:2026-03-10T18:00Z',
      phaseExists: true,
      alreadyAdvancedForSlot: false,
      dataConditionSatisfied: true
    })).toBe('due');

    expect(evaluateDue({
      record: { ...base, status: 'awaiting_data' },
      currentSlotId: 'interval_hours:6:2026-03-10T18:00Z',
      phaseExists: true,
      alreadyAdvancedForSlot: false,
      dataConditionSatisfied: false
    })).toBe('awaiting_data');
  });

  it('T-INV-L4 classifies retryability and retry limits deterministically', () => {
    const phase = {
      phaseId: 'gather',
      kind: 'gather' as const,
      requiredInputs: [],
      produces: [],
      retryPolicy: 'bounded' as const,
      maxRetries: 2
    };

    expect(maxRetriesForPhase(phase)).toBe(2);
    expect(classifyPhaseFailure({ phase, error: new Error('transient') })).toBe('retryable');
    expect(classifyPhaseFailure({ phase, error: new InvestigationAwaitingDataError('wait') })).toBe('awaiting_data');
  });
});
