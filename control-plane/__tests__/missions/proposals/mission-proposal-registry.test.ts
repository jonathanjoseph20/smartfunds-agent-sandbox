import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createMissionProposalRegistry,
  loadMissionProposalDefinitions,
} from '../../../missions/proposals/mission-proposal-registry.ts';
import { deriveMissionProposalIdFromPayload } from '../../../missions/proposals/mission-proposal-identity.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-proposal-registry');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeDefinition(proposalType: string) {
  return {
    proposalType,
    displayName: proposalType,
    description: `${proposalType} description`,
    summary: `${proposalType} summary`,
    enabled: true,
    recommendedPriority: 'normal',
    defaultProposedMissionType: 'produce-market-memo',
    defaultProposedTemplateId: 'produce-market-memo',
    supportedMissionTypes: ['produce-market-memo'],
    supportedTemplateIds: ['produce-market-memo'],
    allowedCreatedByKinds: ['founder', 'agent', 'system'],
    allowedCreatedFromKinds: ['action_plan', 'portfolio_intelligence', 'market_synthesis', 'mission', 'dag', 'manual'],
  };
}

function makeInstance() {
  const identityPayload = {
    proposalType: 'market-memo-request',
    objective: 'obj',
    summary: 'sum',
    rationale: 'why',
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
    summary: 'sum',
    objective: 'obj',
    rationale: 'why',
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
    createdBy: { kind: 'agent', id: 'a-1', displayName: 'Agent 1' },
    createdFrom: { kind: 'manual', id: 'm-1' },
    approvalState: 'pending_review',
    proposalState: 'submitted',
    blockingReasons: [],
    limitations: [],
    recommendedPriority: 'normal',
    historyDigest: '',
  };
}

describe('mission proposal registry', () => {
  it('T-MP-R1 loads definitions in deterministic order', () => {
    writeJson('zeta.json', makeDefinition('zeta-proposal'));
    writeJson('alpha.json', makeDefinition('alpha-proposal'));

    const loaded = loadMissionProposalDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.proposalType)).toEqual(['alpha-proposal', 'zeta-proposal']);
  });

  it('T-MP-R2 rejects invalid definitions', () => {
    writeJson('invalid.json', {
      ...makeDefinition('invalid-proposal'),
      supportedTemplateIds: [123],
    });

    expect(() => loadMissionProposalDefinitions({ definitionsDir: tmpRoot })).toThrow(/supportedTemplateIds/);
  });

  it('T-MP-R3 loads proposal instances and supports lookup', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    const instDir = path.join(tmpRoot, 'instances');
    fs.mkdirSync(defsDir, { recursive: true });
    fs.mkdirSync(instDir, { recursive: true });

    fs.writeFileSync(path.join(defsDir, 'market-memo-request.json'), `${JSON.stringify(makeDefinition('market-memo-request'), null, 2)}\n`, 'utf8');
    const instance = makeInstance();
    fs.writeFileSync(path.join(instDir, `${instance.proposalId}.json`), `${JSON.stringify(instance, null, 2)}\n`, 'utf8');

    const registry = createMissionProposalRegistry({
      definitionsDir: defsDir,
      instancesDir: instDir,
    });

    expect(registry.getProposalDefinition('market-memo-request').proposalType).toBe('market-memo-request');
    expect(registry.getProposalInstance(instance.proposalId).proposalId).toBe(instance.proposalId);
  });
});
