import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../../missions/mission-identity.ts';
import { createMissionDAGHistoryStore } from '../../../missions/dag/mission-dag-history-store.ts';
import { createMissionDAGInspection } from '../../../missions/dag/mission-dag-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-dag-integration');

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

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission DAG integration flow', () => {
  it('T-MDAG-I1 create -> inspect -> status -> history -> materialize is deterministic', () => {
    const missionDefinitionsDir = path.join(tmpRoot, 'definitions');
    const missionInstancesDir = path.join(tmpRoot, 'instances');
    const dagDefinitionsDir = path.join(tmpRoot, 'mission-dags');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-dags');

    const missionTypes = ['evaluate-startup-opportunity', 'market-research', 'product-specification'];
    for (const missionType of missionTypes) {
      writeMissionDefinition(missionDefinitionsDir, missionType);
    }

    const missionIds = missionTypes.map((missionType, index) => {
      const missionId = deriveMissionIdFromPayload({
        missionType,
        objective: `objective-${missionType}`,
        requestedDeliverables: [{ deliverableId: 'memo' }],
        sourceReferences: [{ sourceKind: 'memo', sourceId: `${missionType}-memo`, reference: `memo://${missionType}` }],
        linkedActionPlanIds: [],
        founderInstructions: 'deterministic',
        createdFrom: { kind: 'founder_directive' },
      });

      writeJson(path.join(missionInstancesDir, `${missionId}.json`), {
        missionId,
        missionType,
        displayName: missionType,
        objective: `objective-${missionType}`,
        founderInstructions: 'deterministic',
        requestedDeliverables: [{ deliverableId: 'memo' }],
        sourceReferences: [{ sourceKind: 'memo', sourceId: `${missionType}-memo`, reference: `memo://${missionType}` }],
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

      return missionId;
    });

    writeJson(path.join(dagDefinitionsDir, 'evaluate-startup-opportunity-dag.json'), {
      displayName: 'Evaluate Startup Opportunity DAG',
      rootMissionId: missionIds[0],
      nodes: missionIds.map((missionId) => ({ missionId })),
      edges: [
        { parentMissionId: missionIds[0], childMissionId: missionIds[1] },
        { parentMissionId: missionIds[1], childMissionId: missionIds[2] },
      ],
    });

    const inspection = createMissionDAGInspection({
      dagDefinitionsDir,
      missionDefinitionsDir,
      missionInstancesDir,
      missionDAGArtifactsRoot: artifactsRoot,
    });

    const listed = inspection.listMissionDAGs();
    expect(listed).toHaveLength(1);

    const dagId = listed[0].dagId;

    const historyStore = createMissionDAGHistoryStore({ artifactsRoot });
    historyStore.append({
      dagId,
      eventType: 'dag_created',
      payload: { rootMissionId: missionIds[0] },
      reasoning: 'dag_created',
      slotReference: 'slot:2026-03-11',
    });

    const projected = inspection.getMissionDAG(dagId);
    expect(projected.dagId).toBe(dagId);

    const status = inspection.getMissionDAGStatus(dagId);
    expect(status.dagStatus).toBe('READY');

    const history = inspection.getMissionDAGHistory(dagId);
    expect(history.entries).toHaveLength(1);

    const firstMaterialized = inspection.materializeMissionDAG(dagId);
    expect(fs.existsSync(firstMaterialized.statusPath)).toBe(true);
    expect(fs.existsSync(firstMaterialized.treePath)).toBe(true);
    expect(fs.existsSync(firstMaterialized.reportPath)).toBe(true);
    expect(fs.existsSync(firstMaterialized.historyPath)).toBe(true);

    const firstSnapshot = {
      status: fs.readFileSync(firstMaterialized.statusPath, 'utf8'),
      tree: fs.readFileSync(firstMaterialized.treePath, 'utf8'),
      report: fs.readFileSync(firstMaterialized.reportPath, 'utf8'),
      history: fs.readFileSync(firstMaterialized.historyPath, 'utf8'),
    };

    const secondMaterialized = inspection.materializeMissionDAG(dagId);
    const secondSnapshot = {
      status: fs.readFileSync(secondMaterialized.statusPath, 'utf8'),
      tree: fs.readFileSync(secondMaterialized.treePath, 'utf8'),
      report: fs.readFileSync(secondMaterialized.reportPath, 'utf8'),
      history: fs.readFileSync(secondMaterialized.historyPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
  });
});
