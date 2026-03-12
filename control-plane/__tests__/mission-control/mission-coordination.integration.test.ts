import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionCoordination } from '../../mission-control/mission-coordination-manager.ts';
import { createMissionCoordinationInspection } from '../../mission-control/mission-coordination-inspection.ts';
import { createMissionCoordinationProjection } from '../../mission-control/mission-coordination-projection.ts';
import type { MissionRunProjection } from '../../mission-control/mission-run-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-coordination-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createRunProjection(overrides: Partial<MissionRunProjection> = {}): MissionRunProjection {
  return {
    missionRunId: 'run-int-1',
    missionId: 'mission-1',
    executionAttemptId: 'attempt-1',
    runtimeEnvelopeId: 'envelope-1',
    executionContractId: 'contract-1',
    operationalState: 'active',
    completionState: 'in_progress',
    healthState: 'unstable',
    progressSummary: {
      totalTaskCount: 3,
      pendingTaskCount: 1,
      readyTaskCount: 1,
      runningTaskCount: 1,
      retryingTaskCount: 0,
      completedTaskCount: 0,
      failedTaskCount: 0,
      blockedTaskCount: 0,
      skippedTaskCount: 0,
      completionPercent: 20,
      criticalPathState: 'constrained',
      remainingBlockingNodes: [],
    },
    escalations: [],
    blockingReasons: [],
    workerLoadSummary: [],
    lastExecutionEventId: null,
    lastOrchestrationCycleIndex: 1,
    statusPreview: {},
    reportPreview: {},
    artifactPaths: {
      dirPath: '',
      statusJsonPath: '',
      progressJsonPath: '',
      reportJsonPath: '',
      reportMarkdownPath: '',
      historyJsonPath: '',
      escalationsJsonPath: '',
      healthJsonPath: '',
    },
    ...overrides,
  };
}

describe('mission coordination integration', () => {
  it('T-MCI1 executes deterministic pause/resume/dependency/replay flow', () => {
    const missionRunProjection = {
      projectOne: () => createRunProjection(),
    } as never;

    const projection = createMissionCoordinationProjection({
      missionRunProjection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const coordination = createMissionCoordination({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const inspection = createMissionCoordinationInspection({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const paused = coordination.pauseMission({
      missionRunId: 'run-int-1',
      requestedBy: 'operator',
      reasonTokens: ['maintenance'],
    });
    if ('error' in paused) {
      throw new Error('EXPECTED_PAUSE_SUCCESS');
    }

    const resumed = coordination.resumeMission({
      missionRunId: 'run-int-1',
      requestedBy: 'operator',
      reasonTokens: ['resume'],
    });
    if ('error' in resumed) {
      throw new Error('EXPECTED_RESUME_SUCCESS');
    }

    coordination.linkDependency({
      missionRunId: 'run-int-1',
      sourceMissionRunId: 'run-int-1',
      targetMissionRunId: 'run-upstream',
      relationshipType: 'depends_on',
      blockingReasonTokens: ['upstream_block'],
    });

    coordination.unblockDependency({
      missionRunId: 'run-int-1',
      sourceMissionRunId: 'run-int-1',
      targetMissionRunId: 'run-upstream',
      relationshipType: 'depends_on',
      blockingReasonTokens: ['upstream_block'],
    });

    coordination.reprioritizeMission({
      missionRunId: 'run-int-1',
      requestedBy: 'operator',
      priority: 'high',
      reasonTokens: ['risk_signal'],
    });

    const coordinationProjection = inspection.inspectMissionCoordination({ missionRunId: 'run-int-1' });
    const history = inspection.inspectMissionCoordinationHistory({ missionRunId: 'run-int-1' });
    const replayed = inspection.inspectMissionCoordinationHistory({ missionRunId: 'run-int-1' });

    expect(coordinationProjection.priority).toBe('high');
    expect(coordinationProjection.lifecycleState).toBe('active');
    expect(history.entries.length).toBeGreaterThan(0);
    expect(replayed).toEqual(history);
  });
});
