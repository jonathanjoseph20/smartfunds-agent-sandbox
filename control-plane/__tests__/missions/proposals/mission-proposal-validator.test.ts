import { describe, expect, it } from 'vitest';

import { deriveMissionProposalIdFromPayload } from '../../../missions/proposals/mission-proposal-identity.ts';
import { validateMissionProposalInstance } from '../../../missions/proposals/mission-proposal-validator.ts';

function baseInstance() {
  const identityPayload = {
    proposalType: 'market-memo-request',
    objective: 'objective',
    summary: 'summary',
    rationale: 'rationale',
    proposedMissionType: 'produce-market-memo',
    proposedTemplateId: 'produce-market-memo',
    proposedParameters: { market_topic: 'rwa' },
    requestedDeliverables: [],
    sourceReferences: [],
    linkedMissionIds: [],
    linkedDagIds: [],
    linkedActionPlanIds: [],
    createdBy: { kind: 'agent' },
    createdFrom: { kind: 'manual' },
  } as const;

  return {
    proposalId: deriveMissionProposalIdFromPayload(identityPayload),
    proposalType: 'market-memo-request',
    displayName: 'Market Memo Request',
    summary: 'summary',
    objective: 'objective',
    rationale: 'rationale',
    proposedMissionType: 'produce-market-memo',
    proposedTemplateId: 'produce-market-memo',
    proposedParameters: { market_topic: 'rwa' },
    proposedFounderInstructions: '',
    requestedDeliverables: [],
    sourceReferences: [],
    linkedMissionIds: [],
    linkedDagIds: [],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    createdBy: {
      kind: 'agent',
      id: 'agent-1',
      displayName: 'Agent One',
    },
    createdFrom: {
      kind: 'manual',
      id: 'manual-1',
    },
    approvalState: 'pending_review',
    proposalState: 'submitted',
    blockingReasons: [],
    limitations: [],
    recommendedPriority: 'normal',
    historyDigest: '',
  };
}

describe('mission proposal validator', () => {
  it('T-MP-V1 rejects invalid template linkage', () => {
    const payload = baseInstance();
    payload.proposedTemplateId = 'missing-template';

    expect(() => validateMissionProposalInstance(payload)).toThrow(/MISSION_PROPOSAL_TEMPLATE_NOT_FOUND/);
  });

  it('T-MP-V2 rejects invalid parameters for template', () => {
    const payload = baseInstance();
    payload.proposedParameters = {};

    expect(() => validateMissionProposalInstance(payload)).toThrow(/Missing required template parameter/);
  });

  it('T-MP-V3 rejects unsupported source kind', () => {
    const payload = baseInstance() as Record<string, unknown>;
    payload.createdFrom = { kind: 'invalid-kind', id: 'x' };

    expect(() => validateMissionProposalInstance(payload)).toThrow(/createdFrom.kind/);
  });

  it('T-MP-V4 rejects malformed provenance', () => {
    const payload = baseInstance() as Record<string, unknown>;
    payload.createdBy = { kind: 'agent', displayName: 'missing-id' };

    expect(() => validateMissionProposalInstance(payload)).toThrow(/createdBy.id/);
  });
});
