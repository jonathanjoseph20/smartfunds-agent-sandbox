import { describe, expect, it } from 'vitest';

import { deriveMissionProposalIdFromPayload } from '../../../missions/proposals/mission-proposal-identity.ts';

const basePayload = {
  proposalType: 'market-memo-request',
  objective: 'Produce a market memo for tokenized treasuries.',
  summary: 'Market memo request for treasury landscape.',
  rationale: 'Opportunity surfaced in daily synthesis.',
  proposedMissionType: 'produce-market-memo',
  proposedTemplateId: 'produce-market-memo',
  proposedParameters: {
    market: 'tokenized-treasuries',
    focus: 'liquidity',
  },
  requestedDeliverables: [
    { deliverableId: 'memo' },
  ],
  sourceReferences: [
    { sourceKind: 'market_synthesis', sourceId: 'ms-1', reference: 'sec-1' },
  ],
  linkedMissionIds: ['mission-b', 'mission-a'],
  linkedDagIds: ['dag-b', 'dag-a'],
  linkedActionPlanIds: ['plan-b', 'plan-a'],
  createdBy: { kind: 'agent' },
  createdFrom: { kind: 'market_synthesis' },
} as const;

describe('mission proposal identity', () => {
  it('T-MP-I1 identical payload yields identical proposalId', () => {
    expect(deriveMissionProposalIdFromPayload(basePayload)).toBe(deriveMissionProposalIdFromPayload(basePayload));
  });

  it('T-MP-I2 normalizes ordering for deterministic proposalId', () => {
    const one = deriveMissionProposalIdFromPayload(basePayload);
    const two = deriveMissionProposalIdFromPayload({
      ...basePayload,
      linkedMissionIds: ['mission-a', 'mission-b'],
      linkedDagIds: ['dag-a', 'dag-b'],
      linkedActionPlanIds: ['plan-a', 'plan-b'],
      proposedParameters: {
        focus: 'liquidity',
        market: 'tokenized-treasuries',
      },
    });

    expect(one).toBe(two);
  });

  it('T-MP-I3 excludes runtime metadata from identity payload', () => {
    const one = deriveMissionProposalIdFromPayload(basePayload);
    const two = deriveMissionProposalIdFromPayload({
      ...basePayload,
      createdBy: { kind: 'agent' },
      createdFrom: { kind: 'market_synthesis' },
    });

    expect(one).toBe(two);
  });
});
