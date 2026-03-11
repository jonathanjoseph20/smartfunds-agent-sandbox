import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionHistoryStore } from '../../missions/mission-history-store.ts';
import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createMissionInspection } from '../../missions/mission-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('missions integration flow', () => {
  it('T-MINT1 create -> inspect -> materialize keeps deterministic outputs', () => {
    const definitionsDir = path.join(tmpRoot, 'definitions');
    const instancesDir = path.join(tmpRoot, 'instances');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'missions');

    writeJson(path.join(definitionsDir, 'produce-market-memo.json'), {
      missionType: 'produce-market-memo',
      displayName: 'Produce Market Memo',
      enabled: true,
      description: 'desc',
      defaultObjective: 'objective',
      defaultDeliverables: ['market_summary', 'risk_opportunity_brief'],
      allowedSourceKinds: ['memo', 'synthesis'],
      defaultPriority: 'normal',
      defaultLifecycleState: 'draft',
      tags: ['market'],
    });

    const missionId = deriveMissionIdFromPayload({
      missionType: 'produce-market-memo',
      objective: 'Create market memo for founder',
      requestedDeliverables: [
        { deliverableId: 'market_summary' },
        { deliverableId: 'risk_opportunity_brief' },
      ],
      sourceReferences: [
        { sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' },
      ],
      linkedActionPlanIds: ['plan-1'],
      founderInstructions: 'Use conservative assumptions',
      createdFrom: { kind: 'founder_directive' },
    });

    writeJson(path.join(instancesDir, `${missionId}.json`), {
      missionId,
      missionType: 'produce-market-memo',
      displayName: 'Produce Market Memo',
      objective: 'Create market memo for founder',
      founderInstructions: 'Use conservative assumptions',
      requestedDeliverables: [
        { deliverableId: 'market_summary' },
        { deliverableId: 'risk_opportunity_brief' },
      ],
      sourceReferences: [
        { sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' },
      ],
      linkedActionPlanIds: ['plan-1'],
      linkedPortfolioIds: ['portfolio-1'],
      linkedMarketSynthesisIds: ['market-synthesis-1'],
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
    });

    const historyStore = createMissionHistoryStore({ artifactsRoot });
    historyStore.append({
      missionId,
      eventType: 'deliverables_declared',
      payload: {
        deliverables: [
          { deliverableId: 'market_summary', satisfied: true },
        ],
      },
      reasoning: 'deliverables_progress_recorded',
      slotReference: 'slot:2026-03-11',
    });

    const inspection = createMissionInspection({
      definitionsDir,
      instancesDir,
      missionArtifactsRoot: artifactsRoot,
    });

    const projected = inspection.inspectMission(missionId);
    expect(projected.missionId).toBe(missionId);
    expect(projected.status.completionState).toBe('in_progress');

    const materialized = inspection.materializeMission(missionId);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);

    const statusPayload = JSON.parse(fs.readFileSync(materialized.statusPath, 'utf8')) as Record<string, unknown>;
    expect(statusPayload.missionId).toBe(missionId);
    expect(statusPayload.completionState).toBe('in_progress');
  });
});
