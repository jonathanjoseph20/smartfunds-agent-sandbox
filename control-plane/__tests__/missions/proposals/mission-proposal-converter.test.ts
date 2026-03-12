import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { createMissionProposalConverter } from '../../../missions/proposals/mission-proposal-converter.ts';
import { deriveMissionProposalIdFromPayload } from '../../../missions/proposals/mission-proposal-identity.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-proposal-converter');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify(value)}\n`, 'utf8');
}

function baseProposal(overrides: Record<string, unknown> = {}) {
  const base = {
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
    approvalState: 'approved',
    proposalState: 'approved',
    blockingReasons: [],
    limitations: [],
    recommendedPriority: 'normal',
    historyDigest: '',
    ...overrides,
  };

  const identityPayload = {
    proposalType: base.proposalType,
    objective: base.objective,
    summary: base.summary,
    rationale: base.rationale,
    proposedMissionType: base.proposedMissionType,
    proposedTemplateId: base.proposedTemplateId,
    proposedParameters: base.proposedParameters,
    requestedDeliverables: base.requestedDeliverables,
    sourceReferences: base.sourceReferences,
    linkedMissionIds: base.linkedMissionIds,
    linkedDagIds: base.linkedDagIds,
    linkedActionPlanIds: base.linkedActionPlanIds,
    createdBy: { kind: base.createdBy.kind },
    createdFrom: { kind: base.createdFrom.kind },
  } as const;

  return {
    ...base,
    proposalId: deriveMissionProposalIdFromPayload(identityPayload),
  };
}

function prepareProposalFiles(input: { proposal: Record<string, unknown> }) {
  const definitionsDir = path.join(tmpRoot, 'definitions');
  const instancesDir = path.join(tmpRoot, 'instances');
  const missionInstancesDir = path.join(tmpRoot, 'mission-instances');

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

  writeJson(path.join(instancesDir, `${input.proposal.proposalId as string}.json`), input.proposal);

  return {
    definitionsDir,
    instancesDir,
    missionInstancesDir,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission proposal converter', () => {
  it('T-MP-C1 converts approved template proposal to mission', () => {
    const proposal = baseProposal();
    const prepared = prepareProposalFiles({ proposal });

    const converter = createMissionProposalConverter({
      definitionsDir: prepared.definitionsDir,
      instancesDir: prepared.instancesDir,
      missionInstancesDir: prepared.missionInstancesDir,
      missionProposalArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    const result = converter.convertProposal(proposal.proposalId as string);
    expect(result.conversionState).toBe('mission_created');
    expect(result.missionId).toBeTruthy();
  });

  it('T-MP-C2 supports explicit mission conversion path', () => {
    const proposal = baseProposal({
      proposedTemplateId: '',
      requestedDeliverables: [{ deliverableId: 'memo' }],
    });
    const prepared = prepareProposalFiles({ proposal });

    const converter = createMissionProposalConverter({
      definitionsDir: prepared.definitionsDir,
      instancesDir: prepared.instancesDir,
      missionInstancesDir: prepared.missionInstancesDir,
      missionProposalArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    const result = converter.convertProposal(proposal.proposalId as string);
    expect(result.conversionState).toBe('mission_created');
  });

  it('T-MP-C3 blocks conversion before approval', () => {
    const proposal = baseProposal({ approvalState: 'pending_review', proposalState: 'submitted' });
    const prepared = prepareProposalFiles({ proposal });

    const converter = createMissionProposalConverter({
      definitionsDir: prepared.definitionsDir,
      instancesDir: prepared.instancesDir,
      missionInstancesDir: prepared.missionInstancesDir,
      missionProposalArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    const result = converter.convertProposal(proposal.proposalId as string);
    expect(result.conversionState).toBe('conversion_blocked');
  });

  it('T-MP-C4 links existing mission when mission already exists', () => {
    const proposal = baseProposal();
    const prepared = prepareProposalFiles({ proposal });

    const converter = createMissionProposalConverter({
      definitionsDir: prepared.definitionsDir,
      instancesDir: prepared.instancesDir,
      missionInstancesDir: prepared.missionInstancesDir,
      missionProposalArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    const first = converter.convertProposal(proposal.proposalId as string);
    const second = converter.convertProposal(proposal.proposalId as string);

    expect(first.conversionState).toBe('mission_created');
    expect(second.conversionState).toBe('mission_linked_existing');
    expect(second.missionId).toBe(first.missionId);
  });

  it('T-MP-C5 conversion is idempotent for same proposal', () => {
    const proposal = baseProposal();
    const prepared = prepareProposalFiles({ proposal });

    const converter = createMissionProposalConverter({
      definitionsDir: prepared.definitionsDir,
      instancesDir: prepared.instancesDir,
      missionInstancesDir: prepared.missionInstancesDir,
      missionProposalArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    const one = converter.convertProposal(proposal.proposalId as string);
    const two = converter.convertProposal(proposal.proposalId as string);

    expect(two.missionId).toBe(one.missionId);
  });
});
