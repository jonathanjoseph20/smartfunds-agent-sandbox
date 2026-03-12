import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main as instantiateTemplateMain } from '../../cli/mission-templates-instantiate.ts';
import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createTeamCompatibilityInspection } from '../../team-compatibility/team-compatibility-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-compatibility-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedFixtures(): {
  missionDefinitionsDir: string;
  missionInstancesDir: string;
  teamDefinitionsDir: string;
  compatibilityArtifactsRoot: string;
  missionId: string;
  missionFilePath: string;
  teamFilePath: string;
} {
  const missionDefinitionsDir = path.join(tmpRoot, 'missions', 'definitions');
  const missionInstancesDir = path.join(tmpRoot, 'missions', 'instances');
  const teamDefinitionsDir = path.join(tmpRoot, 'teams', 'definitions');
  const compatibilityArtifactsRoot = path.join(tmpRoot, 'artifacts', 'team-compatibility');

  writeJson(path.join(missionDefinitionsDir, 'generate-product-spec.json'), {
    missionType: 'generate-product-spec',
    displayName: 'Generate Product Spec',
    enabled: true,
    description: 'desc',
    defaultObjective: 'objective',
    defaultDeliverables: ['product_spec', 'mvp_scope'],
    allowedSourceKinds: ['memo'],
    defaultPriority: 'normal',
    defaultLifecycleState: 'draft',
    tags: ['product', 'roadmap'],
  });

  const missionId = deriveMissionIdFromPayload({
    missionType: 'generate-product-spec',
    objective: 'objective',
    requestedDeliverables: [
      { deliverableId: 'product_spec' },
      { deliverableId: 'mvp_scope' },
    ],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    founderInstructions: 'none',
    createdFrom: { kind: 'founder_directive' },
  });

  const missionFilePath = path.join(missionInstancesDir, `${missionId}.json`);
  writeJson(missionFilePath, {
    missionId,
    missionType: 'generate-product-spec',
    displayName: 'Mission',
    objective: 'objective',
    founderInstructions: 'none',
    requestedDeliverables: [
      { deliverableId: 'product_spec' },
      { deliverableId: 'mvp_scope' },
    ],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [],
    assignedTeamIds: [],
    approvalState: 'approved',
    lifecycleState: 'draft',
    readinessState: 'ready',
    completionState: 'not_started',
    blockingReasons: [],
    limitations: [],
    createdFrom: { kind: 'founder_directive' },
    historyDigest: '',
  });

  const teamFilePath = path.join(teamDefinitionsDir, 'team-ready.json');

  writeJson(teamFilePath, {
    teamId: 'team-ready',
    displayName: 'team-ready',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['product_spec', 'mvp_scope'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'available',
    readinessState: 'ready',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 1,
      maxAgents: 2,
      requiredCapabilities: ['product_spec'],
    },
    notes: ['note'],
  });

  writeJson(path.join(teamDefinitionsDir, 'team-manual.json'), {
    teamId: 'team-manual',
    displayName: 'team-manual',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['mvp_scope'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'manual_only',
    readinessState: 'ready',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 1,
      maxAgents: 2,
      requiredCapabilities: ['mvp_scope'],
    },
    notes: ['note'],
  });

  writeJson(path.join(teamDefinitionsDir, 'team-blocked.json'), {
    teamId: 'team-blocked',
    displayName: 'team-blocked',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['product_spec'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'archived',
    availabilityState: 'unavailable',
    readinessState: 'blocked',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 1,
      maxAgents: 2,
      requiredCapabilities: ['product_spec'],
    },
    notes: ['note'],
  });

  return {
    missionDefinitionsDir,
    missionInstancesDir,
    teamDefinitionsDir,
    compatibilityArtifactsRoot,
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team compatibility integration', () => {
  it('T-TC-I1 evaluate -> inspect -> materialize is deterministic and pre-assignment only', () => {
    const fixtures = seedFixtures();

    const inspection = createTeamCompatibilityInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
    });

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    const listed = inspection.listCompatibilitySets();
    expect(listed).toHaveLength(1);
    expect(listed[0].missionId).toBe(fixtures.missionId);

    const projection = inspection.inspectCompatibilitySetByMission(fixtures.missionId);
    expect(projection.compatibilityState).toBe('ready');
    expect(projection.supportedTeamCount).toBeGreaterThan(0);

    const sortedTeamIds = projection.candidateTeams.map((entry) => entry.teamId);
    expect(sortedTeamIds).toEqual(['team-ready', 'team-manual', 'team-blocked']);

    const status = inspection.getCompatibilityStatusByMission(fixtures.missionId);
    expect((status as { missionId: string }).missionId).toBe(fixtures.missionId);

    const historyBefore = inspection.getCompatibilityHistoryByMission(fixtures.missionId);
    expect(historyBefore.entries).toEqual([]);

    const materialized = inspection.materializeCompatibilityByMission(fixtures.missionId);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);

    const historyAfter = inspection.getCompatibilityHistoryByMission(fixtures.missionId);
    expect(historyAfter.entries.length).toBeGreaterThan(0);

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);

    const missionParsed = JSON.parse(missionAfter) as { assignedTeamIds: string[]; lifecycleState: string };
    expect(missionParsed.assignedTeamIds).toEqual([]);
    expect(missionParsed.lifecycleState).toBe('draft');
  });

  it('T-TC-I2 persisted template instantiation is visible to compatibility inspection', async () => {
    const paramsFile = path.join(tmpRoot, 'template-params.json');
    const missionInstancesDir = path.join(tmpRoot, 'templated-missions');
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(paramsFile, `${JSON.stringify({ market_topic: 'RWA settlement' }, null, 2)}\n`, 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const instantiateCode = await instantiateTemplateMain([
      '--template',
      'produce-market-memo',
      '--params-file',
      paramsFile,
      '--write',
      '--instances-dir',
      missionInstancesDir,
    ]);
    const payload = JSON.parse(stdout.mock.calls.map((call) => String(call[0])).join('')) as {
      missionId: string;
      persisted: boolean;
    };
    stdout.mockRestore();

    expect(instantiateCode).toBe(0);
    expect(payload.persisted).toBe(true);

    const inspection = createTeamCompatibilityInspection({
      missionInstancesDir,
    });

    const listed = inspection.listCompatibilitySets();
    expect(listed.map((entry) => entry.missionId)).toContain(payload.missionId);

    const projection = inspection.inspectCompatibilitySetByMission(payload.missionId);
    expect(projection.missionId).toBe(payload.missionId);
    expect(projection.candidateTeams.length).toBeGreaterThan(0);
  });
});
