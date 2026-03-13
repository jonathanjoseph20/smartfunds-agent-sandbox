import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionReviewInspection } from '../../mission-control/mission-review-inspection.ts';
import { createMissionReviewManager } from '../../mission-control/mission-review-manager.ts';
import { createMissionReviewMaterializer } from '../../mission-control/mission-review-materializer.ts';
import { createMissionReviewProjection } from '../../mission-control/mission-review-projection.ts';
import type { MissionCoordinationProjection } from '../../mission-control/mission-coordination.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-review-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function coordinationProjection(): MissionCoordinationProjection {
  return {
    missionRunId: 'run-1',
    lifecycleState: 'active',
    coordinationState: 'blocked_by_escalation',
    priority: 'critical',
    activeInterventions: [],
    dependencySummaries: [],
    blockingMissionRunIds: [],
    blockedByEscalations: ['esc-1'],
    resumeEligibility: 'ineligible',
    lastLifecycleTransitionId: null,
    lastInterventionId: null,
    statusPreview: {
      missionRunId: 'run-1',
      coordinationState: 'blocked_by_escalation',
    },
    reportPreview: {
      missionRunId: 'run-1',
      blockedByEscalations: ['esc-1'],
    },
  };
}

describe('mission review integration', () => {
  it('T-MR-I1 deterministic replay and materialization without upstream coordination mutation', () => {
    const missionRunProjection = {
      summarizeList: () => [{ missionRunId: 'run-1' }],
    } as never;

    const missionCoordinationProjection = {
      projectOne: () => coordinationProjection(),
    } as never;

    const projection = createMissionReviewProjection({
      missionRunProjection,
      missionCoordinationProjection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const inspection = createMissionReviewInspection({ projection });
    const manager = createMissionReviewManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });
    const materializer = createMissionReviewMaterializer({
      inspection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const beforeCoordination = missionCoordinationProjection.projectOne({ missionRunId: 'run-1' });

    const queueFirst = inspection.inspectReviewQueueEntry({ missionRunId: 'run-1' });
    const queueSecond = inspection.inspectReviewQueueEntry({ missionRunId: 'run-1' });

    expect(queueFirst?.reviewQueueEntryId).toBe(queueSecond?.reviewQueueEntryId);

    const approved = manager.approveMission({
      missionRunId: 'run-1',
      requestedBy: 'operator',
      reasonTokens: ['manual_review_complete'],
    });

    expect(approved.governanceStatus).toBe('approved');

    const replayFirst = inspection.inspectDecisionHistory({ missionRunId: 'run-1' });
    const replaySecond = inspection.inspectDecisionHistory({ missionRunId: 'run-1' });
    expect(replaySecond).toEqual(replayFirst);

    const firstMaterialized = materializer.materializeOne({ missionRunId: 'run-1' });
    const secondMaterialized = materializer.materializeOne({ missionRunId: 'run-1' });

    const firstSnapshot = {
      status: fs.readFileSync(firstMaterialized.statusPath, 'utf8'),
      queue: fs.readFileSync(firstMaterialized.queuePath, 'utf8'),
      requirements: fs.readFileSync(firstMaterialized.requirementsPath, 'utf8'),
      history: fs.readFileSync(firstMaterialized.decisionHistoryPath, 'utf8'),
      outcome: fs.readFileSync(firstMaterialized.decisionOutcomePath, 'utf8'),
      report: fs.readFileSync(firstMaterialized.reportPath, 'utf8'),
      markdown: fs.readFileSync(firstMaterialized.reportMarkdownPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(secondMaterialized.statusPath, 'utf8'),
      queue: fs.readFileSync(secondMaterialized.queuePath, 'utf8'),
      requirements: fs.readFileSync(secondMaterialized.requirementsPath, 'utf8'),
      history: fs.readFileSync(secondMaterialized.decisionHistoryPath, 'utf8'),
      outcome: fs.readFileSync(secondMaterialized.decisionOutcomePath, 'utf8'),
      report: fs.readFileSync(secondMaterialized.reportPath, 'utf8'),
      markdown: fs.readFileSync(secondMaterialized.reportMarkdownPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);

    const afterCoordination = missionCoordinationProjection.projectOne({ missionRunId: 'run-1' });
    expect(afterCoordination).toEqual(beforeCoordination);
  });
});
