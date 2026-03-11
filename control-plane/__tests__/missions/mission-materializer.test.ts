import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionMaterializer } from '../../missions/mission-materializer.ts';
import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-materializer');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function setupFixture(): { definitionsDir: string; instancesDir: string; artifactsRoot: string; missionId: string } {
  const definitionsDir = path.join(tmpRoot, 'definitions');
  const instancesDir = path.join(tmpRoot, 'instances');
  const artifactsRoot = path.join(tmpRoot, 'artifacts', 'missions');

  const definition = {
    missionType: 'produce-market-memo',
    displayName: 'Produce Market Memo',
    enabled: true,
    description: 'desc',
    defaultObjective: 'objective',
    defaultDeliverables: ['market_summary'],
    allowedSourceKinds: ['memo'],
    defaultPriority: 'normal',
    defaultLifecycleState: 'draft',
    tags: ['market'],
  };

  const missionId = deriveMissionIdFromPayload({
    missionType: definition.missionType,
    objective: 'Create memo',
    requestedDeliverables: [{ deliverableId: 'market_summary' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: ['plan-1'],
    founderInstructions: 'Keep it concise',
    createdFrom: { kind: 'founder_directive' },
  });

  const instance = {
    missionId,
    missionType: definition.missionType,
    displayName: definition.displayName,
    objective: 'Create memo',
    founderInstructions: 'Keep it concise',
    requestedDeliverables: [{ deliverableId: 'market_summary' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: ['plan-1'],
    linkedPortfolioIds: [],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [],
    assignedTeamIds: [],
    approvalState: 'approved',
    lifecycleState: 'active',
    readinessState: 'ready',
    completionState: 'not_started',
    blockingReasons: [],
    limitations: [],
    createdFrom: { kind: 'founder_directive' },
    historyDigest: '',
  };

  writeJson(path.join(definitionsDir, 'produce-market-memo.json'), definition);
  writeJson(path.join(instancesDir, `${missionId}.json`), instance);

  return {
    definitionsDir,
    instancesDir,
    artifactsRoot,
    missionId,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission materializer', () => {
  it('T-MM1 writes required artifacts', () => {
    const fixture = setupFixture();
    const materializer = createMissionMaterializer({
      definitionsDir: fixture.definitionsDir,
      instancesDir: fixture.instancesDir,
      missionArtifactsRoot: fixture.artifactsRoot,
    });

    const result = materializer.materializeOne(fixture.missionId);

    expect(fs.existsSync(result.statusPath)).toBe(true);
    expect(fs.existsSync(result.reportPath)).toBe(true);
    expect(fs.existsSync(result.markdownPath)).toBe(true);
    expect(fs.existsSync(result.historyPath)).toBe(true);
  });

  it('T-MM2 repeated materialization is deterministic', () => {
    const fixture = setupFixture();
    const materializer = createMissionMaterializer({
      definitionsDir: fixture.definitionsDir,
      instancesDir: fixture.instancesDir,
      missionArtifactsRoot: fixture.artifactsRoot,
    });

    const first = materializer.materializeOne(fixture.missionId);
    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
    };

    const second = materializer.materializeOne(fixture.missionId);
    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
  });
});
