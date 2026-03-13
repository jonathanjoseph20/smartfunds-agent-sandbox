import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionExecutionActivationManager } from '../../mission-control/mission-execution-activation-manager.ts';
import { createMissionExecutionActivationProjection } from '../../mission-control/mission-execution-activation-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-mission-execution-activation-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission execution activation integration', () => {
  it('T-MEA-I1 full execution coordination -> activation bridge is deterministic and additive', () => {
    const projection = createMissionExecutionActivationProjection({
      coordinationProjection: {
        projectAll: () => [{
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          missionControlInterventionPlanId: 'plan-1',
          executionIntentSummaries: [],
          executionRequestSummaries: [
            {
              executionRequestRecordId: 'request-1',
              missionExecutionCoordinationPlanId: 'exec-plan-1',
              missionControlOrchestrationActionItemId: 'action-1',
              executionIntentId: 'intent-1',
              requestClass: 'task_execution_request',
              targetExecutionDomain: 'mission_execution',
              priority: 'high',
              state: 'submitted',
              reasonTokens: ['seed:a'],
            },
          ],
          feedbackLinkSummaries: [],
          status: { missionExecutionCoordinationPlanId: 'exec-plan-1', status: 'execution_active', reasonTokens: [] },
          outcome: { missionExecutionCoordinationPlanId: 'exec-plan-1', outcome: 'active', reasonTokens: [] },
          priority: 'high',
          linkedActionItemIds: ['action-1'],
          linkedExecutionAttemptIds: [],
          coordinationHistory: { missionExecutionCoordinationPlanId: 'exec-plan-1', entries: [] },
          plan: {
            missionExecutionCoordinationPlanId: 'exec-plan-1',
            missionControlInterventionPlanId: 'plan-1',
            displayName: 'Exec Plan',
            strategyClass: 'dependency_relief_strategy',
            executionIntentIds: [],
            executionRequestIds: ['request-1'],
            priority: 'high',
            state: 'active',
            outcome: 'active',
          },
          statusPreview: {},
          reportPreview: {},
        }],
        projectOne: () => ({}) as never,
        listExecutionCoordinationPlans: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const firstProjection = projection.projectAll()[0];
    expect(firstProjection).toBeDefined();

    const manager = createMissionExecutionActivationManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = manager.materializeExecutionActivationRecord({
      executionActivationRecordId: firstProjection!.executionActivationRecordId,
    });

    const second = manager.materializeExecutionActivationRecord({
      executionActivationRecordId: firstProjection!.executionActivationRecordId,
    });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.historyPath, 'utf8')).toBe(fs.readFileSync(second.historyPath, 'utf8'));

    const projected = projection.projectOne({ executionActivationRecordId: firstProjection!.executionActivationRecordId });
    expect(projected.executionRequestRecordId).toBe('request-1');
    expect(projected.missionExecutionCoordinationPlanId).toBe('exec-plan-1');
  });
});
