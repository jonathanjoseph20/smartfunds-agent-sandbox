import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createTeamCompatibilityHistoryStore } from '../../team-compatibility/team-compatibility-history-store.ts';
import { createTeamCompatibilityMaterializer } from '../../team-compatibility/team-compatibility-materializer.ts';
import { createTeamCompatibilityProjection } from '../../team-compatibility/team-compatibility-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-compatibility-materializer');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedFixtures(): { missionDefinitionsDir: string; missionInstancesDir: string; teamDefinitionsDir: string; missionId: string } {
  const missionDefinitionsDir = path.join(tmpRoot, 'missions', 'definitions');
  const missionInstancesDir = path.join(tmpRoot, 'missions', 'instances');
  const teamDefinitionsDir = path.join(tmpRoot, 'teams', 'definitions');

  writeJson(path.join(missionDefinitionsDir, 'generate-product-spec.json'), {
    missionType: 'generate-product-spec',
    displayName: 'generate-product-spec',
    enabled: true,
    description: 'desc',
    defaultObjective: 'objective',
    defaultDeliverables: ['product_spec'],
    allowedSourceKinds: ['memo'],
    defaultPriority: 'normal',
    defaultLifecycleState: 'draft',
    tags: ['product'],
  });

  const missionId = deriveMissionIdFromPayload({
    missionType: 'generate-product-spec',
    objective: 'objective',
    requestedDeliverables: [{ deliverableId: 'product_spec' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    founderInstructions: 'none',
    createdFrom: { kind: 'founder_directive' },
  });

  writeJson(path.join(missionInstancesDir, `${missionId}.json`), {
    missionId,
    missionType: 'generate-product-spec',
    displayName: 'Mission',
    objective: 'objective',
    founderInstructions: 'none',
    requestedDeliverables: [{ deliverableId: 'product_spec' }],
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

  writeJson(path.join(teamDefinitionsDir, 'team-a.json'), {
    teamId: 'team-a',
    displayName: 'team-a',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['product_spec'],
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

  return {
    missionDefinitionsDir,
    missionInstancesDir,
    teamDefinitionsDir,
    missionId,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team compatibility materializer', () => {
  it('T-TC-M1 generates exact artifact set and repeated materialization is identical', () => {
    const fixtures = seedFixtures();
    const compatibilityArtifactsRoot = path.join(tmpRoot, 'artifacts', 'team-compatibility');

    const historyStore = createTeamCompatibilityHistoryStore({ artifactsRoot: compatibilityArtifactsRoot });
    const projection = createTeamCompatibilityProjection({
      historyStore,
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot,
    });

    const materializer = createTeamCompatibilityMaterializer({
      projection,
      historyStore,
      compatibilityArtifactsRoot,
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
    });

    const first = materializer.materializeOne(fixtures.missionId);
    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
    };

    const second = materializer.materializeOne(fixtures.missionId);
    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot.markdown).toContain('# Team Compatibility Report');

    expect(fs.existsSync(first.statusPath)).toBe(true);
    expect(fs.existsSync(first.reportPath)).toBe(true);
    expect(fs.existsSync(first.markdownPath)).toBe(true);
    expect(fs.existsSync(first.historyPath)).toBe(true);
  });
});
