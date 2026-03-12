import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionCoordination } from '../../mission-control/mission-coordination-manager.ts';
import { createMissionCoordinationProjection } from '../../mission-control/mission-coordination-projection.ts';
import type { MissionRunProjection } from '../../mission-control/mission-run-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-coordination-actions');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createRunProjection(overrides: Partial<MissionRunProjection> = {}): MissionRunProjection {
  return {
    missionRunId: 'run-action-1',
    missionId: 'mission-1',
    executionAttemptId: 'attempt-1',
    runtimeEnvelopeId: 'envelope-1',
    executionContractId: 'contract-1',
    operationalState: 'active',
    completionState: 'in_progress',
    healthState: 'unstable',
    progressSummary: {
      totalTaskCount: 1,
      pendingTaskCount: 0,
      readyTaskCount: 0,
      runningTaskCount: 1,
      retryingTaskCount: 0,
      completedTaskCount: 0,
      failedTaskCount: 0,
      blockedTaskCount: 0,
      skippedTaskCount: 0,
      completionPercent: 0,
      criticalPathState: 'constrained',
      remainingBlockingNodes: [],
    },
    escalations: [],
    blockingReasons: [],
    workerLoadSummary: [],
    lastExecutionEventId: null,
    lastOrchestrationCycleIndex: 0,
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

describe('mission coordination actions', () => {
  it('T-MCA1 pause/resume/cancel/reprioritize append deterministic events', () => {
    const projection = createMissionCoordinationProjection({
      missionRunProjection: {
        projectOne: () => createRunProjection(),
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const coordination = createMissionCoordination({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const paused = coordination.pauseMission({
      missionRunId: 'run-action-1',
      requestedBy: 'operator',
      reasonTokens: ['manual_pause'],
    });
    if ('error' in paused) {
      throw new Error('EXPECTED_PAUSE_SUCCESS');
    }

    const resumed = coordination.resumeMission({
      missionRunId: 'run-action-1',
      requestedBy: 'operator',
      reasonTokens: ['manual_resume'],
    });
    if ('error' in resumed) {
      throw new Error('EXPECTED_RESUME_SUCCESS');
    }

    const cancelled = coordination.cancelMission({
      missionRunId: 'run-action-1',
      requestedBy: 'operator',
      reasonTokens: ['manual_cancel'],
    });
    if ('error' in cancelled) {
      throw new Error('EXPECTED_CANCEL_SUCCESS');
    }
    expect(cancelled.lifecycleState).toBe('cancelled');

    const reprioritized = coordination.reprioritizeMission({
      missionRunId: 'run-action-1',
      requestedBy: 'operator',
      priority: 'critical',
      reasonTokens: ['critical_signal'],
    });

    expect(reprioritized.priority.priority).toBe('critical');
  });

  it('T-MCA2 supports dependency link and unblock append-only flow', () => {
    const projection = createMissionCoordinationProjection({
      missionRunProjection: {
        projectOne: () => createRunProjection(),
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const coordination = createMissionCoordination({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const linked = coordination.linkDependency({
      missionRunId: 'run-action-1',
      sourceMissionRunId: 'run-action-1',
      targetMissionRunId: 'run-action-2',
      relationshipType: 'depends_on',
      blockingReasonTokens: ['upstream_pending'],
    });

    const unblocked = coordination.unblockDependency({
      missionRunId: 'run-action-1',
      sourceMissionRunId: 'run-action-1',
      targetMissionRunId: 'run-action-2',
      relationshipType: 'depends_on',
      blockingReasonTokens: ['upstream_pending'],
    });

    expect(linked.state).toBe('active');
    expect(unblocked.state).toBe('unblocked');
  });
});
