import { describe, expect, it } from 'vitest';

import {
  createMissionIntervention,
  deriveMissionInterventionId,
} from '../../mission-control/mission-intervention.ts';

describe('mission intervention', () => {
  it('T-MI1 creates deterministic intervention identities', () => {
    const input = {
      missionRunId: 'run-1',
      interventionType: 'pause' as const,
      requestedBy: 'operator',
      reasonTokens: ['manual_pause'],
      targetLifecycleState: 'paused' as const,
      linkedEscalationIds: ['esc-1'],
      state: 'recorded' as const,
    };

    expect(deriveMissionInterventionId(input)).toBe(deriveMissionInterventionId(input));
  });

  it('T-MI2 normalizes intervention payload deterministically', () => {
    const intervention = createMissionIntervention({
      missionRunId: 'run-1',
      interventionType: 'reprioritize',
      requestedBy: 'operator',
      reasonTokens: ['b', 'a', 'a'],
      linkedEscalationIds: ['esc-2', 'esc-1', 'esc-2'],
    });

    expect(intervention.reasonTokens).toEqual(['a', 'b']);
    expect(intervention.linkedEscalationIds).toEqual(['esc-1', 'esc-2']);
    expect(intervention.state).toBe('recorded');
  });
});
