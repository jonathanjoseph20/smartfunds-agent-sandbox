import { describe, expect, it } from 'vitest';

import {
  createMissionRelationship,
  deriveMissionRelationshipId,
  unblockMissionRelationship,
} from '../../mission-control/mission-dependency.ts';

describe('mission dependency', () => {
  it('T-MD1 creates deterministic relationship identities', () => {
    const input = {
      sourceMissionRunId: 'run-source',
      targetMissionRunId: 'run-target',
      relationshipType: 'depends_on' as const,
      blockingReasonTokens: ['legal_signoff'],
      state: 'active' as const,
    };

    expect(deriveMissionRelationshipId(input)).toBe(deriveMissionRelationshipId(input));
  });

  it('T-MD2 supports deterministic unblock semantics', () => {
    const linked = createMissionRelationship({
      sourceMissionRunId: 'run-source',
      targetMissionRunId: 'run-target',
      relationshipType: 'depends_on',
      blockingReasonTokens: ['k1', 'k2'],
    });

    const unblocked = unblockMissionRelationship(linked);

    expect(linked.state).toBe('active');
    expect(unblocked.state).toBe('unblocked');
    expect(unblocked.sourceMissionRunId).toBe(linked.sourceMissionRunId);
    expect(unblocked.targetMissionRunId).toBe(linked.targetMissionRunId);
  });
});
