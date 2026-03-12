import { describe, expect, it } from 'vitest';

import { deriveMissionProposalIdFromPayload } from '../../../missions/proposals/mission-proposal-identity.ts';
import { evaluateMissionProposalStatus } from '../../../missions/proposals/mission-proposal-status.ts';

function makeProposal(overrides: Record<string, unknown> = {}) {
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
    createdBy: { kind: 'agent', id: 'agent-1', displayName: 'Agent 1' },
    createdFrom: { kind: 'manual', id: 'manual-1' },
    approvalState: 'pending_review',
    proposalState: 'draft',
    blockingReasons: [],
    limitations: [],
    recommendedPriority: 'normal',
    historyDigest: '',
    ...overrides,
  };
}

describe('mission proposal status', () => {
  it('T-MP-S1 marks draft with pending approval', () => {
    const status = evaluateMissionProposalStatus({
      proposalInstance: makeProposal(),
      historyEntries: [],
    });

    expect(status.proposalState).toBe('draft');
    expect(status.approvalState).toBe('pending_review');
    expect(status.limitations).toContain('proposal_not_submitted');
  });

  it('T-MP-S2 preserves submitted state and computes not_converted', () => {
    const status = evaluateMissionProposalStatus({
      proposalInstance: makeProposal({ proposalState: 'submitted' }),
      historyEntries: [],
    });

    expect(status.proposalState).toBe('submitted');
    expect(status.conversionState).toBe('not_converted');
  });

  it('T-MP-S3 reports approved conversion state from history', () => {
    const proposal = makeProposal({ approvalState: 'approved', proposalState: 'approved' });
    const status = evaluateMissionProposalStatus({
      proposalInstance: proposal,
      historyEntries: [{
        proposalId: proposal.proposalId,
        eventType: 'proposal_converted_to_mission',
        eventDedupeKey: '1',
        payload: { missionId: 'm-1' },
      }],
    });

    expect(status.approvalState).toBe('approved');
    expect(status.conversionState).toBe('mission_created');
  });

  it('T-MP-S4 reports rejected with approval limitation', () => {
    const status = evaluateMissionProposalStatus({
      proposalInstance: makeProposal({ approvalState: 'rejected', proposalState: 'rejected' }),
      historyEntries: [],
    });

    expect(status.approvalState).toBe('rejected');
    expect(status.limitations).toContain('approval_rejected');
  });

  it('T-MP-S5 blocks conversion before approval when attempt exists', () => {
    const proposal = makeProposal({ approvalState: 'pending_review', proposalState: 'under_review' });
    const status = evaluateMissionProposalStatus({
      proposalInstance: proposal,
      historyEntries: [{
        proposalId: proposal.proposalId,
        eventType: 'proposal_conversion_attempted',
        eventDedupeKey: '1',
        payload: {},
      }],
    });

    expect(status.conversionState).toBe('conversion_inconclusive');
    expect(status.blockingReasons).toContain('conversion_before_approval');
  });
});
