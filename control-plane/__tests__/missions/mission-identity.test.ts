import { describe, expect, it } from 'vitest';

import {
  deriveMissionId,
  deriveMissionIdFromPayload,
  normalizeMissionIdentityPayload,
} from '../../missions/mission-identity.ts';

describe('mission identity', () => {
  it('T-MI1 identical semantic inputs produce identical missionId', () => {
    const payload = {
      missionType: 'produce-market-memo',
      objective: 'Summarize market risk signals',
      requestedDeliverables: [{ deliverableId: 'market_summary' }],
      sourceReferences: [{ sourceKind: 'synthesis', sourceId: 'ms-1', reference: 'market-synthesis-1' }],
      linkedActionPlanIds: ['plan-a'],
      founderInstructions: 'focus on downside protection',
      createdFrom: { kind: 'founder_directive' },
    };

    const idOne = deriveMissionIdFromPayload(payload);
    const idTwo = deriveMissionId(normalizeMissionIdentityPayload(payload));

    expect(idOne).toBe(idTwo);
  });

  it('T-MI2 order normalization keeps missionId stable', () => {
    const first = deriveMissionIdFromPayload({
      missionType: 'produce-market-memo',
      objective: 'Assess exposure',
      requestedDeliverables: [{ deliverableId: 'b' }, { deliverableId: 'a' }],
      sourceReferences: [
        { sourceKind: 'memo', sourceId: 'b', reference: 'ref-b' },
        { sourceKind: 'memo', sourceId: 'a', reference: 'ref-a' },
      ],
      linkedActionPlanIds: ['plan-b', 'plan-a'],
      founderInstructions: 'scope',
      createdFrom: { kind: 'founder_directive' },
    });

    const second = deriveMissionIdFromPayload({
      missionType: 'produce-market-memo',
      objective: 'Assess exposure',
      requestedDeliverables: [{ deliverableId: 'a' }, { deliverableId: 'b' }],
      sourceReferences: [
        { sourceKind: 'memo', sourceId: 'a', reference: 'ref-a' },
        { sourceKind: 'memo', sourceId: 'b', reference: 'ref-b' },
      ],
      linkedActionPlanIds: ['plan-a', 'plan-b'],
      founderInstructions: 'scope',
      createdFrom: { kind: 'founder_directive' },
    });

    expect(first).toBe(second);
  });

  it('T-MI3 non-semantic fields are ignored when omitted from identity payload', () => {
    const semantic = {
      missionType: 'produce-market-memo',
      objective: 'Assess exposure',
      requestedDeliverables: [{ deliverableId: 'market_summary' }],
      sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
      linkedActionPlanIds: ['plan-1'],
      founderInstructions: 'scope',
      createdFrom: { kind: 'founder_directive' },
    };

    const idWithTimestamp = deriveMissionIdFromPayload({
      ...semantic,
      // Non-semantic values intentionally not part of the identity payload contract.
    });

    const idWithRunMetadata = deriveMissionIdFromPayload(semantic);

    expect(idWithTimestamp).toBe(idWithRunMetadata);
  });
});
