import {
  createActivationRuntimeIntegrationHistoryStore,
  type ActivationRuntimeIntegrationHistoryStore,
} from './activation-runtime-integration-history-store.ts';
import {
  createActivationRuntimeIntegrationMaterializer,
  type ActivationRuntimeIntegrationMaterializer,
} from './activation-runtime-integration-materializer.ts';
import {
  createActivationRuntimeIntegrationProjection,
  type ActivationRuntimeIntegrationProjectionEngine,
} from './activation-runtime-integration-projection.ts';
import { uniqueSortedStrings } from './activation-runtime-integration-identity.ts';

export function createActivationRuntimeIntegrationManager(options: {
  projection?: ActivationRuntimeIntegrationProjectionEngine;
  historyStore?: ActivationRuntimeIntegrationHistoryStore;
  materializer?: ActivationRuntimeIntegrationMaterializer;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
  taskExecutionArtifactsRoot?: string;
  missionControlArtifactsRoot?: string;
} = {}) {
  const historyStore = options.historyStore ?? createActivationRuntimeIntegrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createActivationRuntimeIntegrationProjection({
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const materializer = options.materializer ?? createActivationRuntimeIntegrationMaterializer({
    projection,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  function evaluateDispatchAttempt(input: { activationDispatchAttemptId: string }) {
    const projected = projection.projectOne(input);

    historyStore.appendEvent({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: 'activation_dispatch_attempt_created',
      reasonTokens: uniqueSortedStrings([
        `priority:${projected.dispatchAttempt.priority}`,
        `target_runtime_domain:${projected.dispatchAttempt.targetRuntimeDomain}`,
      ]),
      payload: {
        dispatchAttempt: projected.dispatchAttempt,
      },
    });

    historyStore.appendEvent({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: 'activation_dispatch_queued',
      reasonTokens: projected.dispatchQueueEntry.reasonTokens,
      payload: {
        dispatchQueueEntry: projected.dispatchQueueEntry,
      },
    });

    for (const runtimeLink of projected.runtimeLinkSummaries) {
      historyStore.appendEvent({
        activationDispatchAttemptId: input.activationDispatchAttemptId,
        eventType: 'activation_runtime_link_created',
        reasonTokens: uniqueSortedStrings([
          `runtime_link_class:${runtimeLink.runtimeLinkClass}`,
          `execution_activation_record_id:${runtimeLink.executionActivationRecordId}`,
        ]),
        payload: runtimeLink as unknown as Record<string, unknown>,
      });
    }

    for (const feedbackRecord of projected.feedbackIngestionSummaries) {
      historyStore.appendEvent({
        activationDispatchAttemptId: input.activationDispatchAttemptId,
        eventType: 'runtime_feedback_ingested',
        reasonTokens: uniqueSortedStrings([
          `feedback_class:${feedbackRecord.feedbackClass}`,
          ...feedbackRecord.reasonTokens,
        ]),
        payload: feedbackRecord as unknown as Record<string, unknown>,
      });
    }

    for (const reconciliation of projected.reconciliationSummaries) {
      historyStore.appendEvent({
        activationDispatchAttemptId: input.activationDispatchAttemptId,
        eventType: 'activation_runtime_reconciliation_applied',
        reasonTokens: reconciliation.reasonTokens,
        payload: reconciliation as unknown as Record<string, unknown>,
      });
    }

    return projection.projectOne(input);
  }

  function deferDispatchAttempt(input: { activationDispatchAttemptId: string; reasonTokens?: string[] }) {
    historyStore.appendEvent({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: 'activation_runtime_deferred',
      reasonTokens: uniqueSortedStrings(['state:deferred', ...(input.reasonTokens ?? [])]),
      payload: {
        activationDispatchAttemptId: input.activationDispatchAttemptId,
      },
    });

    return projection.projectOne({ activationDispatchAttemptId: input.activationDispatchAttemptId });
  }

  function markDispatchSubmitted(input: { activationDispatchAttemptId: string; reasonTokens?: string[] }) {
    historyStore.appendEvent({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: 'activation_dispatch_submitted',
      reasonTokens: uniqueSortedStrings(['status:dispatch_submitted', ...(input.reasonTokens ?? [])]),
      payload: {
        activationDispatchAttemptId: input.activationDispatchAttemptId,
      },
    });

    return projection.projectOne({ activationDispatchAttemptId: input.activationDispatchAttemptId });
  }

  function markDispatchComplete(input: { activationDispatchAttemptId: string; reasonTokens?: string[] }) {
    historyStore.appendEvent({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: 'activation_runtime_completed',
      reasonTokens: uniqueSortedStrings(['outcome:completed', ...(input.reasonTokens ?? [])]),
      payload: {
        activationDispatchAttemptId: input.activationDispatchAttemptId,
      },
    });

    return projection.projectOne({ activationDispatchAttemptId: input.activationDispatchAttemptId });
  }

  function materializeDispatchAttempt(input: { activationDispatchAttemptId: string }) {
    evaluateDispatchAttempt(input);
    const materialized = materializer.materializeOne(input);

    historyStore.appendEvent({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: 'activation_runtime_materialized',
      reasonTokens: uniqueSortedStrings([`materialized:${input.activationDispatchAttemptId}`]),
      payload: {
        activationDispatchAttemptId: input.activationDispatchAttemptId,
      },
    });

    return materialized;
  }

  return {
    evaluateDispatchAttempt,
    deferDispatchAttempt,
    markDispatchSubmitted,
    markDispatchComplete,
    materializeDispatchAttempt,
  };
}

export type ActivationRuntimeIntegrationManager = ReturnType<typeof createActivationRuntimeIntegrationManager>;
