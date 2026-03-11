import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { deriveMissionIdFromPayload } from '../../../missions/mission-identity.ts';
import { createMissionDAGProjection } from '../../../missions/dag/mission-dag-projection.ts';
import { createMissionDAGRegistry } from '../../../missions/dag/mission-dag-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-dag-projection');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function setupFixture() {
  const missionDefinitionsDir = path.join(tmpRoot, 'definitions');
  const missionInstancesDir = path.join(tmpRoot, 'instances');
  const dagDefinitionsDir = path.join(tmpRoot, 'mission-dags');

  const missionTypes = ['evaluate-startup-opportunity', 'market-research', 'product-specification'];
  for (const missionType of missionTypes) {
    writeJson(path.join(missionDefinitionsDir, `${missionType}.json`), {
      missionType,
      displayName: missionType,
      enabled: true,
      description: 'desc',
      defaultObjective: 'objective',
      defaultDeliverables: ['memo'],
      allowedSourceKinds: ['memo'],
      defaultPriority: 'normal',
      defaultLifecycleState: 'draft',
      tags: ['dag'],
    });
  }

  const missionIds = missionTypes.map((missionType) => deriveMissionIdFromPayload({
    missionType,
    objective: `objective-${missionType}`,
    requestedDeliverables: [{ deliverableId: 'memo' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: `${missionType}-memo`, reference: `memo://${missionType}` }],
    linkedActionPlanIds: [],
    founderInstructions: 'deterministic',
    createdFrom: { kind: 'founder_directive' },
  }));

  for (let index = 0; index < missionTypes.length; index += 1) {
    writeJson(path.join(missionInstancesDir, `${missionIds[index]}.json`), {
      missionId: missionIds[index],
      missionType: missionTypes[index],
      displayName: missionTypes[index],
      objective: `objective-${missionTypes[index]}`,
      founderInstructions: 'deterministic',
      requestedDeliverables: [{ deliverableId: 'memo' }],
      sourceReferences: [{ sourceKind: 'memo', sourceId: `${missionTypes[index]}-memo`, reference: `memo://${missionTypes[index]}` }],
      linkedActionPlanIds: [],
      linkedPortfolioIds: [],
      linkedMarketSynthesisIds: [],
      recommendedTeamIds: [],
      assignedTeamIds: [],
      approvalState: 'approved',
      lifecycleState: index === 0 ? 'completed' : 'active',
      readinessState: 'ready',
      completionState: index === 0 ? 'completed' : 'in_progress',
      blockingReasons: [],
      limitations: [],
      createdFrom: { kind: 'founder_directive' },
      historyDigest: '',
    });
  }

  writeJson(path.join(dagDefinitionsDir, 'evaluate-startup-opportunity-dag.json'), {
    displayName: 'Evaluate Startup Opportunity DAG',
    rootMissionId: missionIds[0],
    nodes: missionIds.map((missionId) => ({ missionId })),
    edges: [
      { parentMissionId: missionIds[0], childMissionId: missionIds[1] },
      { parentMissionId: missionIds[1], childMissionId: missionIds[2] },
    ],
  });

  return {
    missionDefinitionsDir,
    missionInstancesDir,
    dagDefinitionsDir,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission DAG projection', () => {
  it('T-MDAG-P1 projects deterministic DAG structure and status', () => {
    const fixture = setupFixture();
    const registry = createMissionDAGRegistry({
      definitionsDir: fixture.dagDefinitionsDir,
      missionDefinitionsDir: fixture.missionDefinitionsDir,
      missionInstancesDir: fixture.missionInstancesDir,
    });

    const dagId = registry.listMissionDAGDefinitions()[0].dagId;

    const projection = createMissionDAGProjection({
      dagRegistry: registry,
      missionDefinitionsDir: fixture.missionDefinitionsDir,
      missionInstancesDir: fixture.missionInstancesDir,
    });

    const first = projection.projectOne(dagId);
    const second = projection.projectOne(dagId);

    expect(first.dagId).toBe(dagId);
    expect(first.readyNodes.length).toBeGreaterThanOrEqual(1);
    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
  });
});
