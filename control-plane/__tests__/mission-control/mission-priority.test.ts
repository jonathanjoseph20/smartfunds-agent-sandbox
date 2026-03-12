import { describe, expect, it } from 'vitest';

import {
  createMissionPrioritySignal,
  deriveMissionPriorityUpdateId,
} from '../../mission-control/mission-priority.ts';

describe('mission priority', () => {
  it('T-MP1 creates deterministic priority update identity', () => {
    const input = {
      missionRunId: 'run-1',
      priority: 'high' as const,
      reasonTokens: ['risk_signal'],
    };

    expect(deriveMissionPriorityUpdateId(input)).toBe(deriveMissionPriorityUpdateId(input));
  });

  it('T-MP2 normalizes priority reason tokens', () => {
    const signal = createMissionPrioritySignal({
      missionRunId: 'run-1',
      priority: 'deferred',
      reasonTokens: ['b', 'a', 'a'],
    });

    expect(signal.reasonTokens).toEqual(['a', 'b']);
  });
});
