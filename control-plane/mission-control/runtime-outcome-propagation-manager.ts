import {
  createRuntimeOutcomePropagationHistoryStore,
  type RuntimeOutcomePropagationHistoryStore,
} from './runtime-outcome-propagation-history-store.ts';
import {
  createRuntimeOutcomePropagationMaterializer,
  type RuntimeOutcomePropagationMaterializer,
} from './runtime-outcome-propagation-materializer.ts';
import {
  createRuntimeOutcomePropagationProjection,
  type RuntimeOutcomePropagationProjectionEngine,
} from './runtime-outcome-propagation-projection.ts';
import { uniqueSortedStrings } from './runtime-outcome-propagation-identity.ts';

export function createRuntimeOutcomePropagationManager(options: {
  projection?: RuntimeOutcomePropagationProjectionEngine;
  historyStore?: RuntimeOutcomePropagationHistoryStore;
  materializer?: RuntimeOutcomePropagationMaterializer;
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
  const historyStore = options.historyStore ?? createRuntimeOutcomePropagationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createRuntimeOutcomePropagationProjection({
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

  const materializer = options.materializer ?? createRuntimeOutcomePropagationMaterializer({
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

  function evaluatePropagationRecord(input: { runtimeOutcomePropagationRecordId: string }) {
    const projected = projection.projectOne(input);

    historyStore.appendEvent({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      eventType: 'runtime_outcome_propagation_record_created',
      reasonTokens: uniqueSortedStrings([
        `propagation_class:${projected.record.propagationClass}`,
        `target_layer:${projected.record.targetLayer}`,
      ]),
      payload: {
        record: projected.record,
      },
    });

    for (const activation of projected.activationPropagationSummaries) {
      historyStore.appendEvent({
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
        eventType: 'activation_lifecycle_propagated',
        reasonTokens: activation.reasonTokens,
        payload: activation as unknown as Record<string, unknown>,
      });
    }

    for (const coordination of projected.executionCoordinationPropagationSummaries) {
      historyStore.appendEvent({
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
        eventType: 'execution_coordination_propagated',
        reasonTokens: coordination.reasonTokens,
        payload: coordination as unknown as Record<string, unknown>,
      });
    }

    for (const orchestration of projected.missionOrchestrationPropagationSummaries) {
      historyStore.appendEvent({
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
        eventType: 'mission_orchestration_propagated',
        reasonTokens: orchestration.reasonTokens,
        payload: orchestration as unknown as Record<string, unknown>,
      });
    }

    for (const portfolio of projected.missionPortfolioPropagationSummaries) {
      historyStore.appendEvent({
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
        eventType: 'mission_portfolio_state_propagated',
        reasonTokens: portfolio.reasonTokens,
        payload: portfolio as unknown as Record<string, unknown>,
      });
    }

    return projection.projectOne(input);
  }

  function deferPropagationRecord(input: { runtimeOutcomePropagationRecordId: string; reasonTokens?: string[] }) {
    historyStore.appendEvent({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      eventType: 'runtime_outcome_propagation_deferred',
      reasonTokens: uniqueSortedStrings(['status:deferred', ...(input.reasonTokens ?? [])]),
      payload: {
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      },
    });

    return projection.projectOne({ runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId });
  }

  function markPropagationApplied(input: { runtimeOutcomePropagationRecordId: string; reasonTokens?: string[] }) {
    const projected = projection.projectOne({ runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId });

    historyStore.appendEvent({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      eventType: 'execution_coordination_propagated',
      reasonTokens: uniqueSortedStrings(['status:applied', ...(input.reasonTokens ?? [])]),
      payload: {
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
        status: projected.status,
      },
    });

    return projection.projectOne({ runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId });
  }

  function markPropagationComplete(input: { runtimeOutcomePropagationRecordId: string; reasonTokens?: string[] }) {
    historyStore.appendEvent({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      eventType: 'runtime_outcome_propagation_materialized',
      reasonTokens: uniqueSortedStrings(['status:complete', ...(input.reasonTokens ?? [])]),
      payload: {
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      },
    });

    return projection.projectOne({ runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId });
  }

  function materializePropagationRecord(input: { runtimeOutcomePropagationRecordId: string }) {
    evaluatePropagationRecord(input);
    const materialized = materializer.materializeOne(input);

    historyStore.appendEvent({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      eventType: 'runtime_outcome_propagation_materialized',
      reasonTokens: uniqueSortedStrings([`materialized:${input.runtimeOutcomePropagationRecordId}`]),
      payload: {
        runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      },
    });

    return materialized;
  }

  return {
    evaluatePropagationRecord,
    deferPropagationRecord,
    markPropagationApplied,
    markPropagationComplete,
    materializePropagationRecord,
  };
}

export type RuntimeOutcomePropagationManager = ReturnType<typeof createRuntimeOutcomePropagationManager>;
