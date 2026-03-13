import {
  createMissionExecutionCoordinationHistoryStore,
  type MissionExecutionCoordinationHistoryStore,
} from './mission-execution-coordination-history-store.ts';
import {
  createMissionExecutionCoordinationMaterializer,
  type MissionExecutionCoordinationMaterializer,
} from './mission-execution-coordination-materializer.ts';
import {
  createMissionExecutionCoordinationProjection,
  type MissionExecutionCoordinationProjectionEngine,
} from './mission-execution-coordination-projection.ts';
import { uniqueSortedStrings } from './mission-execution-coordination-identity.ts';

export function createMissionExecutionCoordinationManager(options: {
  projection?: MissionExecutionCoordinationProjectionEngine;
  historyStore?: MissionExecutionCoordinationHistoryStore;
  materializer?: MissionExecutionCoordinationMaterializer;
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
  const historyStore = options.historyStore ?? createMissionExecutionCoordinationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionExecutionCoordinationProjection({
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

  const materializer = options.materializer ?? createMissionExecutionCoordinationMaterializer({
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

  function evaluateExecutionCoordinationPlan(input: { missionExecutionCoordinationPlanId: string }) {
    const projected = projection.projectOne(input);

    historyStore.appendEvent({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      eventType: 'mission_execution_coordination_plan_created',
      reasonTokens: uniqueSortedStrings([
        `state:${projected.plan.state}`,
        `priority:${projected.plan.priority}`,
      ]),
      payload: {
        plan: projected.plan,
      },
    });

    for (const intent of projected.executionIntentSummaries) {
      historyStore.appendEvent({
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        eventType: 'execution_intent_created',
        reasonTokens: intent.reasonTokens,
        payload: {
          executionIntentId: intent.executionIntentId,
          intent,
        },
      });
    }

    for (const request of projected.executionRequestSummaries) {
      historyStore.appendEvent({
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        eventType: 'execution_request_record_created',
        reasonTokens: request.reasonTokens,
        payload: {
          executionRequestRecordId: request.executionRequestRecordId,
          request,
        },
      });

      if (request.state === 'queued' || request.state === 'active' || request.state === 'submitted') {
        historyStore.appendEvent({
          missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
          eventType: 'execution_request_queued',
          reasonTokens: request.reasonTokens,
          payload: {
            executionRequestRecordId: request.executionRequestRecordId,
          },
        });
      }

      if (request.state === 'submitted' || request.state === 'active') {
        historyStore.appendEvent({
          missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
          eventType: 'execution_request_submitted',
          reasonTokens: request.reasonTokens,
          payload: {
            executionRequestRecordId: request.executionRequestRecordId,
          },
        });
      }
    }

    for (const feedbackLink of projected.feedbackLinkSummaries) {
      historyStore.appendEvent({
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        eventType: 'execution_feedback_linked',
        reasonTokens: uniqueSortedStrings([
          `feedback_class:${feedbackLink.feedbackClass}`,
          `execution_request_record_id:${feedbackLink.executionRequestRecordId}`,
        ]),
        payload: feedbackLink as unknown as Record<string, unknown>,
      });
    }

    return projection.projectOne(input);
  }

  function deferExecutionCoordinationPlan(input: {
    missionExecutionCoordinationPlanId: string;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      eventType: 'execution_coordination_deferred',
      reasonTokens: uniqueSortedStrings(['state:deferred', ...(input.reasonTokens ?? [])]),
      payload: {
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      },
    });

    return projection.projectOne({ missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId });
  }

  function markExecutionCoordinationPlanActive(input: {
    missionExecutionCoordinationPlanId: string;
    reasonTokens?: string[];
  }) {
    const projected = projection.projectOne({ missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId });

    for (const request of projected.executionRequestSummaries) {
      historyStore.appendEvent({
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        eventType: 'execution_request_submitted',
        reasonTokens: uniqueSortedStrings(['state:active', ...(input.reasonTokens ?? []), ...request.reasonTokens]),
        payload: {
          executionRequestRecordId: request.executionRequestRecordId,
        },
      });
    }

    return projection.projectOne({ missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId });
  }

  function markExecutionCoordinationPlanComplete(input: {
    missionExecutionCoordinationPlanId: string;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      eventType: 'execution_coordination_completed',
      reasonTokens: uniqueSortedStrings(['outcome:completed', ...(input.reasonTokens ?? [])]),
      payload: {
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      },
    });

    return projection.projectOne({ missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId });
  }

  function materializeExecutionCoordinationPlan(input: { missionExecutionCoordinationPlanId: string }) {
    evaluateExecutionCoordinationPlan(input);
    const materialized = materializer.materializeOne(input);

    historyStore.appendEvent({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      eventType: 'mission_execution_materialized',
      reasonTokens: uniqueSortedStrings([
        `materialized:${input.missionExecutionCoordinationPlanId}`,
      ]),
      payload: {
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      },
    });

    return materialized;
  }

  return {
    evaluateExecutionCoordinationPlan,
    deferExecutionCoordinationPlan,
    markExecutionCoordinationPlanActive,
    markExecutionCoordinationPlanComplete,
    materializeExecutionCoordinationPlan,
  };
}

export type MissionExecutionCoordinationManager = ReturnType<typeof createMissionExecutionCoordinationManager>;
