import { describe, expect, it } from 'vitest';

import { deriveRuntimeEnvelopeStatus } from '../../runtime-envelope/runtime-envelope-status.ts';

describe('runtime envelope status', () => {
  it('T-MRE-S1 derives eligible evaluated state when upstream is eligible', () => {
    const status = deriveRuntimeEnvelopeStatus({
      executionEligibilityState: 'eligible',
      contractState: 'ready_for_runtime_handoff',
      contractBlockers: [],
      contractLimitations: [],
    });

    expect(status.envelopeEligibility).toBe('eligible');
    expect(status.envelopeState).toBe('evaluated');
  });

  it('T-MRE-S2 keeps waiting eligibility separate from lifecycle state', () => {
    const status = deriveRuntimeEnvelopeStatus({
      executionEligibilityState: 'waiting_on_runtime_preparation',
      contractState: 'under_review',
      contractBlockers: [],
      contractLimitations: [],
    });

    expect(status.envelopeEligibility).toBe('waiting_on_runtime_support');
    expect(status.envelopeState).toBe('under_review');
  });

  it('T-MRE-S3 derives rejected and blocked after explicit rejection event', () => {
    const status = deriveRuntimeEnvelopeStatus({
      executionEligibilityState: 'eligible',
      contractState: 'ready_for_runtime_handoff',
      contractBlockers: [],
      contractLimitations: [],
      historyEntries: [{
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm1',
        eventType: 'runtime_envelope_rejected',
        eventDedupeKey: 'k1',
        reasoning: 'rejected',
        payload: {},
      }],
    });

    expect(status.envelopeState).toBe('rejected');
    expect(status.envelopeEligibility).toBe('blocked');
    expect(status.blockers).toContain('runtime_envelope_rejected');
  });

  it('T-MRE-S4 derives ready_for_runtime after confirmation event', () => {
    const status = deriveRuntimeEnvelopeStatus({
      executionEligibilityState: 'eligible',
      contractState: 'ready_for_runtime_handoff',
      contractBlockers: [],
      contractLimitations: [],
      historyEntries: [{
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm1',
        eventType: 'runtime_envelope_confirmed',
        eventDedupeKey: 'k-confirmed',
        reasoning: 'confirmed',
        payload: {},
      }],
    });

    expect(status.envelopeEligibility).toBe('eligible');
    expect(status.envelopeState).toBe('ready_for_runtime');
  });
});
