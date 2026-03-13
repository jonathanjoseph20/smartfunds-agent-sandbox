import {
  createMissionExecutionActivationHistoryStore,
  type MissionExecutionActivationHistoryStore,
} from './mission-execution-activation-history-store.ts';
import {
  createMissionExecutionActivationMaterializer,
  type MissionExecutionActivationMaterializer,
} from './mission-execution-activation-materializer.ts';
import {
  createMissionExecutionActivationProjection,
  type MissionExecutionActivationProjectionEngine,
} from './mission-execution-activation-projection.ts';
import { uniqueSortedStrings } from './mission-execution-activation-identity.ts';
import type { ExecutionActivationFeedbackClass } from './mission-execution-activation-types.ts';

export function createMissionExecutionActivationManager(options: {
  projection?: MissionExecutionActivationProjectionEngine;
  historyStore?: MissionExecutionActivationHistoryStore;
  materializer?: MissionExecutionActivationMaterializer;
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
  const historyStore = options.historyStore ?? createMissionExecutionActivationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionExecutionActivationProjection({
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

  const materializer = options.materializer ?? createMissionExecutionActivationMaterializer({
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

  function evaluateExecutionActivationRecord(input: { executionActivationRecordId: string }) {
    const projected = projection.projectOne(input);

    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'execution_activation_record_created',
      reasonTokens: uniqueSortedStrings([
        `state:${projected.activationRecord.state}`,
        `priority:${projected.activationRecord.priority}`,
      ]),
      payload: {
        activationRecord: projected.activationRecord,
      },
    });

    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'execution_activation_eligibility_evaluated',
      reasonTokens: projected.eligibility.reasonTokens,
      payload: {
        eligibility: projected.eligibility,
      },
    });

    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'execution_activation_queued',
      reasonTokens: projected.queueEntry?.reasonTokens ?? [],
      payload: {
        queueEntry: projected.queueEntry,
      },
    });

    for (const feedbackLink of projected.feedbackLinkSummaries) {
      historyStore.appendEvent({
        executionActivationRecordId: input.executionActivationRecordId,
        eventType: 'execution_activation_feedback_linked',
        reasonTokens: uniqueSortedStrings([
          `feedback_class:${feedbackLink.feedbackClass}`,
          `execution_request_record_id:${feedbackLink.executionRequestRecordId}`,
        ]),
        payload: feedbackLink as unknown as Record<string, unknown>,
      });
    }

    return projection.projectOne(input);
  }

  function linkActivationFeedback(input: {
    executionActivationRecordId: string;
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionActivationFeedbackClass;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: input.feedbackClass === 'handoff_submitted'
        ? 'execution_activation_handoff_submitted'
        : 'execution_activation_feedback_linked',
      reasonTokens: uniqueSortedStrings([
        `feedback_class:${input.feedbackClass}`,
        ...(input.reasonTokens ?? []),
      ]),
      payload: {
        executionActivationRecordId: input.executionActivationRecordId,
        executionRequestRecordId: input.executionRequestRecordId,
        executionAttemptId: input.executionAttemptId ?? null,
        taskExecutionRunId: input.taskExecutionRunId ?? null,
        workerResultId: input.workerResultId ?? null,
        feedbackClass: input.feedbackClass,
      },
    });

    return projection.projectOne({ executionActivationRecordId: input.executionActivationRecordId });
  }

  function deferExecutionActivationRecord(input: {
    executionActivationRecordId: string;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'execution_activation_deferred',
      reasonTokens: uniqueSortedStrings(['state:deferred', ...(input.reasonTokens ?? [])]),
      payload: {
        executionActivationRecordId: input.executionActivationRecordId,
      },
    });

    return projection.projectOne({ executionActivationRecordId: input.executionActivationRecordId });
  }

  function markExecutionActivationSubmitted(input: {
    executionActivationRecordId: string;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'execution_activation_handoff_submitted',
      reasonTokens: uniqueSortedStrings(['status:handoff_submitted', ...(input.reasonTokens ?? [])]),
      payload: {
        executionActivationRecordId: input.executionActivationRecordId,
      },
    });

    return projection.projectOne({ executionActivationRecordId: input.executionActivationRecordId });
  }

  function markExecutionActivationComplete(input: {
    executionActivationRecordId: string;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'execution_activation_completed',
      reasonTokens: uniqueSortedStrings(['outcome:completed', ...(input.reasonTokens ?? [])]),
      payload: {
        executionActivationRecordId: input.executionActivationRecordId,
      },
    });

    return projection.projectOne({ executionActivationRecordId: input.executionActivationRecordId });
  }

  function materializeExecutionActivationRecord(input: { executionActivationRecordId: string }) {
    evaluateExecutionActivationRecord(input);
    const materialized = materializer.materializeOne(input);

    historyStore.appendEvent({
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: 'mission_execution_activation_materialized',
      reasonTokens: uniqueSortedStrings([`materialized:${input.executionActivationRecordId}`]),
      payload: {
        executionActivationRecordId: input.executionActivationRecordId,
      },
    });

    return materialized;
  }

  return {
    evaluateExecutionActivationRecord,
    linkActivationFeedback,
    deferExecutionActivationRecord,
    markExecutionActivationSubmitted,
    markExecutionActivationComplete,
    materializeExecutionActivationRecord,
  };
}

export type MissionExecutionActivationManager = ReturnType<typeof createMissionExecutionActivationManager>;
