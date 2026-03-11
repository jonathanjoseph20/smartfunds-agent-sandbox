import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../../missions/mission-identity.ts';
import {
  computeMissionDAGId,
  createMissionDAGRegistry,
} from '../../../missions/dag/mission-dag-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-dag-registry');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMissionDefinition(definitionsDir: string, missionType: string): void {
  writeJson(path.join(definitionsDir, `${missionType}.json`), {
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

function writeMissionInstance(instancesDir: string, input: { missionType: string; objective: string; missionId?: string }): string {
  const missionId = input.missionId ?? deriveMissionIdFromPayload({
    missionType: input.missionType,
    objective: input.objective,
    requestedDeliverables: [{ deliverableId: 'memo' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: `${input.missionType}-memo`, reference: `memo://${input.missionType}` }],
    linkedActionPlanIds: [],
    founderInstructions: 'deterministic',
    createdFrom: { kind: 'founder_directive' },
  });

  writeJson(path.join(instancesDir, `${missionId}.json`), {
    missionId,
    missionType: input.missionType,
    displayName: input.missionType,
    objective: input.objective,
    founderInstructions: 'deterministic',
    requestedDeliverables: [{ deliverableId: 'memo' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: `${input.missionType}-memo`, reference: `memo://${input.missionType}` }],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [],
    assignedTeamIds: [],
    approvalState: 'approved',
    lifecycleState: 'active',
    readinessState: 'ready',
    completionState: 'in_progress',
    blockingReasons: [],
    limitations: [],
    createdFrom: { kind: 'founder_directive' },
    historyDigest: '',
  });

  return missionId;
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission DAG registry', () => {
  it('T-MDAG-R1 computes deterministic identity from root/nodes/edges only', () => {
    const first = computeMissionDAGId({
      rootMissionId: 'mission-root',
      nodes: [{ missionId: 'mission-a' }, { missionId: 'mission-root' }],
      edges: [{ parentMissionId: 'mission-root', childMissionId: 'mission-a' }],
    });

    const second = computeMissionDAGId({
      rootMissionId: 'mission-root',
      nodes: [{ missionId: 'mission-root' }, { missionId: 'mission-a' }],
      edges: [{ parentMissionId: 'mission-root', childMissionId: 'mission-a' }],
    });

    expect(first).toBe(second);
  });

  it('T-MDAG-R2 loads DAG definitions in deterministic dagId order', () => {
    const dagDefinitionsDir = path.join(tmpRoot, 'mission-dags');
    const missionDefinitionsDir = path.join(tmpRoot, 'definitions');
    const missionInstancesDir = path.join(tmpRoot, 'instances');

    writeMissionDefinition(missionDefinitionsDir, 'mission-a');
    writeMissionDefinition(missionDefinitionsDir, 'mission-b');
    writeMissionDefinition(missionDefinitionsDir, 'mission-c');

    const missionAId = writeMissionInstance(missionInstancesDir, { missionType: 'mission-a', objective: 'A' });
    const missionBId = writeMissionInstance(missionInstancesDir, { missionType: 'mission-b', objective: 'B' });
    const missionCId = writeMissionInstance(missionInstancesDir, { missionType: 'mission-c', objective: 'C' });

    writeJson(path.join(dagDefinitionsDir, 'zeta.json'), {
      displayName: 'Zeta DAG',
      rootMissionId: missionAId,
      nodes: [
        { missionId: missionAId },
        { missionId: missionBId },
      ],
      edges: [
        { parentMissionId: missionAId, childMissionId: missionBId },
      ],
    });

    writeJson(path.join(dagDefinitionsDir, 'alpha.json'), {
      displayName: 'Alpha DAG',
      rootMissionId: missionBId,
      nodes: [
        { missionId: missionBId },
        { missionId: missionCId },
      ],
      edges: [
        { parentMissionId: missionBId, childMissionId: missionCId },
      ],
    });

    const registry = createMissionDAGRegistry({
      definitionsDir: dagDefinitionsDir,
      missionDefinitionsDir,
      missionInstancesDir,
    });

    const listed = registry.listMissionDAGDefinitions();
    const dagIds = listed.map((entry) => entry.dagId);
    expect(dagIds).toEqual([...dagIds].sort((left, right) => left.localeCompare(right)));
  });

  it('T-MDAG-R3 rejects duplicate deterministic dag identities', () => {
    const dagDefinitionsDir = path.join(tmpRoot, 'mission-dags');
    const missionDefinitionsDir = path.join(tmpRoot, 'definitions');
    const missionInstancesDir = path.join(tmpRoot, 'instances');

    writeMissionDefinition(missionDefinitionsDir, 'mission-a');
    writeMissionDefinition(missionDefinitionsDir, 'mission-b');

    const missionAId = writeMissionInstance(missionInstancesDir, { missionType: 'mission-a', objective: 'A' });
    const missionBId = writeMissionInstance(missionInstancesDir, { missionType: 'mission-b', objective: 'B' });

    const sharedDefinition = {
      displayName: 'Shared DAG',
      rootMissionId: missionAId,
      nodes: [
        { missionId: missionAId },
        { missionId: missionBId },
      ],
      edges: [{ parentMissionId: missionAId, childMissionId: missionBId }],
    };

    writeJson(path.join(dagDefinitionsDir, 'one.json'), sharedDefinition);
    writeJson(path.join(dagDefinitionsDir, 'two.json'), {
      ...sharedDefinition,
      displayName: 'Same Identity Different Name',
    });

    expect(() => createMissionDAGRegistry({
      definitionsDir: dagDefinitionsDir,
      missionDefinitionsDir,
      missionInstancesDir,
    })).toThrow(/MISSION_DAG_DUPLICATE_DEFINITION/);
  });
});
