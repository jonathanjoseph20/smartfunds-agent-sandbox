import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createRuntimeOutcomePropagationManager } from '../../mission-control/runtime-outcome-propagation-manager.ts';
import { createRuntimeOutcomePropagationProjection } from '../../mission-control/runtime-outcome-propagation-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-runtime-outcome-propagation-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime outcome propagation integration', () => {
  it('T-ROP-I1 full closed-loop propagation is deterministic and additive', () => {
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
            reasonTokens: ['applied'],
            linkedFeedbackRecordIds: [],
            state: 'resolved',
          }],
          status: { activationDispatchAttemptId: 'attempt-1', status: 'runtime_completed', reasonTokens: [] },
          outcome: { activationDispatchAttemptId: 'attempt-1', outcome: 'completed', reasonTokens: [] },
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
          status: { reasonTokens: [] },
        }),
        listActivationRecords: () => [],
        listActivationQueue: () => [],
      } as never,
      coordinationProjection: {
        projectAll: () => [{
          missionExecutionCoordinationPlanId: 'coord-1',
          missionControlInterventionPlanId: 'plan-1',
          executionRequestSummaries: [{ executionRequestRecordId: 'request-1' }],
          status: { status: 'execution_completed', reasonTokens: [] },
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

    const firstProjection = projection.projectAll()[0];
    expect(firstProjection).toBeDefined();

    const manager = createRuntimeOutcomePropagationManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    manager.markPropagationApplied({ runtimeOutcomePropagationRecordId: firstProjection!.runtimeOutcomePropagationRecordId });
    manager.markPropagationComplete({ runtimeOutcomePropagationRecordId: firstProjection!.runtimeOutcomePropagationRecordId });

    const first = manager.materializePropagationRecord({ runtimeOutcomePropagationRecordId: firstProjection!.runtimeOutcomePropagationRecordId });
    const second = manager.materializePropagationRecord({ runtimeOutcomePropagationRecordId: firstProjection!.runtimeOutcomePropagationRecordId });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.historyPath, 'utf8')).toBe(fs.readFileSync(second.historyPath, 'utf8'));

    const projected = projection.projectOne({ runtimeOutcomePropagationRecordId: firstProjection!.runtimeOutcomePropagationRecordId });
    expect(projected.linkedExecutionAttemptIds).toContain('exec-attempt-1');
    expect(projected.record.executionActivationRecordId).toBe('activation-1');
  });
});
