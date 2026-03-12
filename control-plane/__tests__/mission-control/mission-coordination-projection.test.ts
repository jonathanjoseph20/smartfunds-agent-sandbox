import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionCoordinationProjection } from '../../mission-control/mission-coordination-projection.ts';
import { createMissionLifecycleHistoryStore } from '../../mission-control/mission-lifecycle-history-store.ts';
import type { MissionRunProjection } from '../../mission-control/mission-run-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-coordination-projection');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createRunProjection(overrides: Partial<MissionRunProjection> = {}): MissionRunProjection {
  return {
    missionRunId: 'run-1',
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

describe('mission coordination projection', () => {
  it('T-MCP1 derives paused state from lifecycle transitions', () => {
    const historyStore = createMissionLifecycleHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    historyStore.append({
      missionRunId: 'run-1',
      eventType: 'mission_lifecycle_transitioned',
      payload: {
        transition: {
          missionLifecycleTransitionId: 'tr-1',
          missionRunId: 'run-1',
          fromState: 'active',
          toState: 'paused',
          reasonTokens: ['operator_pause'],
          linkedEscalationIds: [],
          linkedInterventionId: 'int-1',
        },
      },
    });

    const projection = createMissionCoordinationProjection({
      historyStore,
      missionRunProjection: {
        projectOne: () => createRunProjection(),
      } as never,
    });

    const result = projection.projectOne({ missionRunId: 'run-1' });
    expect(result.lifecycleState).toBe('paused');
    expect(result.coordinationState).toBe('paused_by_operator');
  });

  it('T-MCP2 derives dependency blocking and priority projection', () => {
    const historyStore = createMissionLifecycleHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    historyStore.append({
      missionRunId: 'run-1',
      eventType: 'mission_dependency_linked',
      payload: {
        relationship: {
          missionRelationshipId: 'rel-1',
          sourceMissionRunId: 'run-1',
          targetMissionRunId: 'run-2',
          relationshipType: 'depends_on',
          blockingReasonTokens: ['upstream_required'],
          state: 'active',
        },
      },
    });

    historyStore.append({
      missionRunId: 'run-1',
      eventType: 'mission_priority_updated',
      payload: {
        prioritySignal: {
          missionRunId: 'run-1',
          priority: 'high',
          reasonTokens: ['risk'],
        },
      },
    });

    const projection = createMissionCoordinationProjection({
      historyStore,
      missionRunProjection: {
        projectOne: () => createRunProjection(),
      } as never,
    });

    const result = projection.projectOne({ missionRunId: 'run-1' });
    expect(result.blockingMissionRunIds).toEqual(['run-2']);
    expect(result.coordinationState).toBe('blocked_by_dependency');
    expect(result.priority).toBe('high');
  });

  it('T-MCP3 derives escalation block and ready_to_resume state', () => {
    const historyStore = createMissionLifecycleHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    historyStore.append({
      missionRunId: 'run-1',
      eventType: 'mission_lifecycle_transitioned',
      payload: {
        transition: {
          missionLifecycleTransitionId: 'tr-resume',
          missionRunId: 'run-1',
          fromState: 'paused',
          toState: 'resuming',
          reasonTokens: ['resume'],
          linkedEscalationIds: [],
          linkedInterventionId: 'int-resume',
        },
      },
    });

    const projectionReady = createMissionCoordinationProjection({
      historyStore,
      missionRunProjection: {
        projectOne: () => createRunProjection(),
      } as never,
    }).projectOne({ missionRunId: 'run-1' });

    expect(projectionReady.coordinationState).toBe('ready_to_resume');

    const projectionEscalated = createMissionCoordinationProjection({
      historyStore,
      missionRunProjection: {
        projectOne: () => createRunProjection({
          escalations: [{
            missionRunId: 'run-1',
            escalationId: 'esc-1',
            escalationClass: 'policy_failure',
            severity: 'high',
            linkedTaskNodeIds: [],
            linkedExecutionEventIds: [],
            reasonTokens: ['x'],
            state: 'open',
          }],
        }),
      } as never,
    }).projectOne({ missionRunId: 'run-1' });

    expect(projectionEscalated.coordinationState).toBe('blocked_by_escalation');
  });
});
