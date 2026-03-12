import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { createMissionProposalInspection } from '../../../missions/proposals/mission-proposal-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-proposal-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify(value)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission proposal integration', () => {
  it('T-MP-INT1 runs full proposal lifecycle deterministically', () => {
    const definitionsDir = path.join(tmpRoot, 'definitions');
    const instancesDir = path.join(tmpRoot, 'instances');
    const missionInstancesDir = path.join(tmpRoot, 'mission-instances');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-proposals');

    writeJson(path.join(definitionsDir, 'market-memo-request.json'), {
      proposalType: 'market-memo-request',
      displayName: 'Market Memo Request',
      description: 'desc',
      summary: 'summary',
      enabled: true,
      recommendedPriority: 'normal',
      defaultProposedMissionType: 'produce-market-memo',
      defaultProposedTemplateId: 'produce-market-memo',
      supportedMissionTypes: ['produce-market-memo'],
      supportedTemplateIds: ['produce-market-memo'],
      allowedCreatedByKinds: ['founder', 'agent', 'system'],
      allowedCreatedFromKinds: ['action_plan', 'portfolio_intelligence', 'market_synthesis', 'mission', 'dag', 'manual'],
    });

    const inspection = createMissionProposalInspection({
      definitionsDir,
      instancesDir,
      missionInstancesDir,
      missionProposalArtifactsRoot: artifactsRoot,
    });

    const submitted = inspection.submitProposalFromInput({
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
      proposalState: 'submitted',
      blockingReasons: [],
      limitations: [],
      recommendedPriority: 'normal',
      historyDigest: '',
    });

    const inspected = inspection.inspectProposal(submitted.proposalId);
    expect(inspected.proposalId).toBe(submitted.proposalId);

    const reviewed = inspection.reviewProposal({
      proposalId: submitted.proposalId,
      decision: 'approved',
      reviewedBy: 'founder-1',
      reason: 'approved for conversion',
    });
    expect(reviewed.approvalState).toBe('approved');

    const converted = inspection.convertProposal(submitted.proposalId);
    expect(converted.missionId).toBeTruthy();

    const materialized = inspection.materializeProposal(submitted.proposalId);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);

    const history = inspection.getProposalHistory(submitted.proposalId);
    const eventTypes = history.entries.map((entry) => entry.eventType);
    expect(eventTypes).toContain('proposal_created');
    expect(eventTypes).toContain('proposal_approved');
    expect(eventTypes.some((entry) => entry === 'proposal_converted_to_mission' || entry === 'proposal_linked_existing_mission')).toBe(true);
  });
});
