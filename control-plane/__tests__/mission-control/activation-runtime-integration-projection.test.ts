import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createActivationRuntimeIntegrationMaterializer } from '../../mission-control/activation-runtime-integration-materializer.ts';
import { createActivationRuntimeIntegrationProjection } from '../../mission-control/activation-runtime-integration-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-activation-runtime-integration-projection');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('activation runtime integration projection', () => {
  it('T-ARI-PR1 projection and materialization are replay-stable and deterministic', () => {
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
        feedbackClass: 'runtime_execution_started',
        linkedRuntimeIds: {
          executionAttemptId: 'exec-attempt-1',
          taskExecutionRunId: 'run-1',
          workerResultId: 'worker-1',
        },
      }],
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const one = projection.projectAll();
    const two = projection.projectAll();

    expect(two).toEqual(one);
    expect(two[0]?.status.status).toBe('runtime_active');

    const materializer = createActivationRuntimeIntegrationMaterializer({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = materializer.materializeOne({ activationDispatchAttemptId: one[0]!.activationDispatchAttemptId });
    const second = materializer.materializeOne({ activationDispatchAttemptId: one[0]!.activationDispatchAttemptId });

    expect(fs.readFileSync(first.dispatchStatusPath, 'utf8')).toBe(fs.readFileSync(second.dispatchStatusPath, 'utf8'));
    expect(fs.readFileSync(first.reportPath, 'utf8')).toBe(fs.readFileSync(second.reportPath, 'utf8'));
  });
});
