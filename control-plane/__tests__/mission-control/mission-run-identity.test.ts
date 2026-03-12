import { describe, expect, it } from 'vitest';

import { deriveMissionRunId } from '../../mission-control/mission-run-identity.ts';

describe('mission run identity', () => {
  it('T-MC-I1 derives deterministic missionRunId from semantic identity only', () => {
    const input = {
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
    };

    expect(deriveMissionRunId(input)).toBe(deriveMissionRunId(input));
  });

  it('T-MC-I2 keeps identity stable across replay and sensitive to semantic changes', () => {
    const first = deriveMissionRunId({
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
    });

    const second = deriveMissionRunId({
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-2',
    });

    expect(first).not.toBe(second);
  });
});
