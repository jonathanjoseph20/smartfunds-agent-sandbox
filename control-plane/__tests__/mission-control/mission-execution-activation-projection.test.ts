import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionExecutionActivationMaterializer } from '../../mission-control/mission-execution-activation-materializer.ts';
import { createMissionExecutionActivationProjection } from '../../mission-control/mission-execution-activation-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-mission-execution-activation-projection');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission execution activation projection', () => {
  it('T-MEA-PR1 projection and materialization are replay-stable and deterministic', () => {
    const projection = createMissionExecutionActivationProjection({
      coordinationProjection: {
        projectAll: () => [{
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          missionControlInterventionPlanId: 'plan-1',
          executionIntentSummaries: [],
          executionRequestSummaries: [{
            executionRequestRecordId: 'request-1',
            missionExecutionCoordinationPlanId: 'exec-plan-1',
            missionControlOrchestrationActionItemId: 'action-1',
            executionIntentId: 'intent-1',
            requestClass: 'task_execution_request',
            targetExecutionDomain: 'mission_execution',
            priority: 'high',
            state: 'submitted',
            reasonTokens: ['seed:a'],
          }],
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
            strategyClass: 'systemic_watch_strategy',
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

    const one = projection.projectAll();
    const two = projection.projectAll();

    expect(two).toEqual(one);
    expect(two[0]!.status.status).toBe('handoff_submitted');

    const materializer = createMissionExecutionActivationMaterializer({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = materializer.materializeOne({ executionActivationRecordId: one[0]!.executionActivationRecordId });
    const second = materializer.materializeOne({ executionActivationRecordId: one[0]!.executionActivationRecordId });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.reportPath, 'utf8')).toBe(fs.readFileSync(second.reportPath, 'utf8'));
  });
});
