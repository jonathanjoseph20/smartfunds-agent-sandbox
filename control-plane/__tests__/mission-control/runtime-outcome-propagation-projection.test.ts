import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createRuntimeOutcomePropagationMaterializer } from '../../mission-control/runtime-outcome-propagation-materializer.ts';
import { createRuntimeOutcomePropagationProjection } from '../../mission-control/runtime-outcome-propagation-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-runtime-outcome-propagation-projection');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime outcome propagation projection', () => {
  it('T-ROP-PR1 projection and materialization are replay-stable with distinct status/outcome', () => {
    const projection = createRuntimeOutcomePropagationProjection({
      runtimeProjection: {
        projectAll: () => [{
          activationDispatchAttemptId: 'attempt-1',
          executionActivationRecordId: 'activation-1',
          dispatchQueueState: 'closed',
          runtimeLinkSummaries: [],
          feedbackIngestionSummaries: [],
          reconciliationSummaries: [{
            activationRuntimeReconciliationId: 'recon-1',
            activationDispatchAttemptId: 'attempt-1',
            reconciliationClass: 'feedback_applied',
            reasonTokens: ['reconciled'],
            linkedFeedbackRecordIds: [],
            state: 'resolved',
          }],
          status: { activationDispatchAttemptId: 'attempt-1', status: 'runtime_completed', reasonTokens: ['runtime_completed'] },
          outcome: { activationDispatchAttemptId: 'attempt-1', outcome: 'completed', reasonTokens: ['completed'] },
          priority: 'high',
          linkedExecutionAttemptIds: ['exec-attempt-1'],
          integrationHistory: { activationDispatchAttemptId: 'attempt-1', entries: [] },
          dispatchAttempt: {
            activationDispatchAttemptId: 'attempt-1',
            executionActivationRecordId: 'activation-1',
            executionRequestRecordId: 'request-1',
            targetRuntimeDomain: 'mission_execution',
            priority: 'high',
            state: 'completed',
            outcome: 'completed',
          },
          dispatchQueueEntry: {
            activationDispatchQueueEntryId: 'queue-1',
            activationDispatchAttemptId: 'attempt-1',
            priority: 'high',
            queueState: 'closed',
            reasonTokens: [],
            state: 'resolved',
          },
          statusPreview: {},
          reportPreview: {},
        }],
        projectOne: () => ({}) as never,
        listDispatchAttempts: () => [],
      } as never,
      activationProjection: {
        projectAll: () => [],
        projectOne: () => ({
          executionActivationRecordId: 'activation-1',
          linkedExecutionAttemptIds: ['exec-attempt-1'],
          status: { reasonTokens: ['activation_status'] },
        }),
        listActivationRecords: () => [],
        listActivationQueue: () => [],
      } as never,
      coordinationProjection: {
        projectAll: () => [{
          missionExecutionCoordinationPlanId: 'coord-1',
          missionControlInterventionPlanId: 'plan-1',
          executionRequestSummaries: [{ executionRequestRecordId: 'request-1' }],
          status: { status: 'execution_completed', reasonTokens: ['coord_status'] },
          outcome: { outcome: 'completed', reasonTokens: [] },
          linkedExecutionAttemptIds: ['exec-attempt-1'],
        }],
        projectOne: () => ({ linkedExecutionAttemptIds: ['exec-attempt-1'] }),
        listExecutionCoordinationPlans: () => [],
      } as never,
      orchestrationProjection: {
        projectAll: () => [{
          missionControlInterventionPlanId: 'plan-1',
          interventionPlan: { state: 'completed', portfolioIds: ['portfolio-1'] },
          orchestrationOutcome: { outcome: 'completed', reasonTokens: [] },
          priorityPosture: { reasonTokens: [] },
        }],
        projectOne: () => ({}) as never,
        listInterventionPlans: () => [],
        inspectOrchestrationQueue: () => [],
      } as never,
      portfolioProjection: {
        projectAll: () => [{
          missionPortfolioId: 'portfolio-1',
          healthState: 'healthy',
          readinessState: 'ready',
          governancePosture: 'compliant',
          blockingClusters: [],
        }],
        projectOne: () => ({}) as never,
        summarizeList: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const one = projection.projectAll();
    const two = projection.projectAll();

    expect(two).toEqual(one);
    expect(two[0]?.status).toBe('applied');
    expect(two[0]?.outcome).toBe('upstream_updated');

    const materializer = createRuntimeOutcomePropagationMaterializer({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = materializer.materializeOne({ runtimeOutcomePropagationRecordId: one[0]!.runtimeOutcomePropagationRecordId });
    const second = materializer.materializeOne({ runtimeOutcomePropagationRecordId: one[0]!.runtimeOutcomePropagationRecordId });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.reportPath, 'utf8')).toBe(fs.readFileSync(second.reportPath, 'utf8'));
  });
});
