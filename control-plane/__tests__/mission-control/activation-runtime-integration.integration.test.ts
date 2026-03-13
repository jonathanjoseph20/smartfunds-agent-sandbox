import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createActivationRuntimeIntegrationManager } from '../../mission-control/activation-runtime-integration-manager.ts';
import { createActivationRuntimeIntegrationProjection } from '../../mission-control/activation-runtime-integration-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-activation-runtime-integration-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('activation runtime integration integration', () => {
  it('T-ARI-I1 full activation -> runtime integration bridge is deterministic and additive', () => {
    const projection = createActivationRuntimeIntegrationProjection({
      activationProjection: {
        projectAll: () => [{
          executionActivationRecordId: 'execution-activation-1',
          executionRequestRecordId: 'execution-request-1',
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          eligibilityStatus: 'eligible',
          queueState: 'handoff_submitted',
          feedbackLinkSummaries: [],
          status: { executionActivationRecordId: 'execution-activation-1', status: 'handoff_submitted', reasonTokens: [] },
          outcome: { executionActivationRecordId: 'execution-activation-1', outcome: 'submitted', reasonTokens: [] },
          priority: 'high',
          linkedExecutionAttemptIds: [],
          activationHistory: { executionActivationRecordId: 'execution-activation-1', entries: [] },
          activationRecord: {
            executionActivationRecordId: 'execution-activation-1',
            executionRequestRecordId: 'execution-request-1',
            missionExecutionCoordinationPlanId: 'exec-plan-1',
            executionIntentId: 'intent-1',
            targetExecutionDomain: 'mission_execution',
            priority: 'high',
            state: 'submitted',
            outcome: 'submitted',
          },
          mapping: {
            executionRequestActivationMappingId: 'mapping-1',
            executionRequestRecordId: 'execution-request-1',
            executionActivationRecordId: 'execution-activation-1',
            activationRule: 'standard_task_activation',
            reasonTokens: [],
            state: 'active',
          },
          eligibility: {
            executionActivationEligibilityId: 'eligibility-1',
            executionRequestRecordId: 'execution-request-1',
            eligibilityStatus: 'eligible',
            reasonTokens: [],
            blockingConditionTokens: [],
            state: 'active',
          },
          queueEntry: null,
          statusPreview: {},
          reportPreview: {},
        }],
        projectOne: () => ({}) as never,
        listActivationRecords: () => [],
        listActivationQueue: () => [],
      } as never,
      runtimeFeedbackRecords: [{
        executionActivationRecordId: 'execution-activation-1',
        feedbackClass: 'runtime_dispatch_accepted',
        linkedRuntimeIds: {
          executionAttemptId: 'exec-attempt-1',
          taskExecutionRunId: 'run-1',
          workerResultId: 'worker-1',
        },
      }],
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const firstProjection = projection.projectAll()[0];
    expect(firstProjection).toBeDefined();

    const manager = createActivationRuntimeIntegrationManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    manager.markDispatchSubmitted({ activationDispatchAttemptId: firstProjection!.activationDispatchAttemptId });
    manager.markDispatchComplete({ activationDispatchAttemptId: firstProjection!.activationDispatchAttemptId });

    const first = manager.materializeDispatchAttempt({ activationDispatchAttemptId: firstProjection!.activationDispatchAttemptId });
    const second = manager.materializeDispatchAttempt({ activationDispatchAttemptId: firstProjection!.activationDispatchAttemptId });

    expect(fs.readFileSync(first.dispatchStatusPath, 'utf8')).toBe(fs.readFileSync(second.dispatchStatusPath, 'utf8'));
    expect(fs.readFileSync(first.historyPath, 'utf8')).toBe(fs.readFileSync(second.historyPath, 'utf8'));

    const projected = projection.projectOne({ activationDispatchAttemptId: firstProjection!.activationDispatchAttemptId });
    expect(projected.executionActivationRecordId).toBe('execution-activation-1');
    expect(projected.linkedExecutionAttemptIds).toContain('exec-attempt-1');
  });
});
