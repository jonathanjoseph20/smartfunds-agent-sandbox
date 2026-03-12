import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { createMissionProposalInspection } from '../../../missions/proposals/mission-proposal-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-proposal-materializer');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify(value)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission proposal materializer', () => {
  it('T-MP-M1 materializes deterministic artifacts repeatedly', () => {
    const definitionsDir = path.join(tmpRoot, 'definitions');
    const instancesDir = path.join(tmpRoot, 'instances');
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

    const one = inspection.materializeProposal(submitted.proposalId);
    const firstStatus = fs.readFileSync(one.statusPath, 'utf8');

    const two = inspection.materializeProposal(submitted.proposalId);
    const secondStatus = fs.readFileSync(two.statusPath, 'utf8');

    expect(firstStatus).toBe(secondStatus);
    expect(fs.existsSync(one.reportPath)).toBe(true);
    expect(fs.existsSync(one.historyPath)).toBe(true);
  });
});
