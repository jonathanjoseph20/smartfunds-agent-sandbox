import {
  createActivationRuntimeIntegrationProjection,
  type ActivationRuntimeIntegrationProjectionEngine,
} from './activation-runtime-integration-projection.ts';
import {
  createMissionControlOrchestrationProjection,
  type MissionControlOrchestrationProjectionEngine,
} from './mission-control-orchestration-projection.ts';
import {
  createMissionExecutionActivationProjection,
  type MissionExecutionActivationProjectionEngine,
} from './mission-execution-activation-projection.ts';
import {
  createMissionExecutionCoordinationProjection,
  type MissionExecutionCoordinationProjectionEngine,
} from './mission-execution-coordination-projection.ts';
import {
  createMissionPortfolioProjection,
  type MissionPortfolioProjectionEngine,
} from './mission-portfolio-projection.ts';
import {
  createRuntimeOutcomePropagationHistoryStore,
  type RuntimeOutcomePropagationHistoryStore,
} from './runtime-outcome-propagation-history-store.ts';
import { createActivationLifecyclePropagation } from './activation-lifecycle-propagation.ts';
import { createExecutionCoordinationPropagation } from './execution-coordination-propagation.ts';
import { createMissionOrchestrationPropagation } from './mission-orchestration-propagation.ts';
import { createMissionPortfolioStatePropagation } from './mission-portfolio-state-propagation.ts';
import { uniqueSortedStrings } from './runtime-outcome-propagation-identity.ts';
import { createRuntimeOutcomePropagationRecord } from './runtime-outcome-propagation-record.ts';
import type { RuntimeOutcomePropagationOutcome } from './runtime-outcome-propagation-outcome.ts';
import type { RuntimeOutcomePropagationStatus } from './runtime-outcome-propagation-status.ts';
import type {
  RuntimeOutcomePropagationProjection,
  RuntimeOutcomePropagationRecord,
} from './runtime-outcome-propagation-types.ts';

function deriveRecordOutcomeFromRuntime(input: { runtimeOutcome: string }): RuntimeOutcomePropagationOutcome {
  if (input.runtimeOutcome === 'failed') {
    return 'failed';
  }
  if (input.runtimeOutcome === 'deferred') {
    return 'deferred';
  }
  if (input.runtimeOutcome === 'inconclusive') {
    return 'inconclusive';
  }
  if (input.runtimeOutcome === 'completed') {
    return 'upstream_updated';
  }
  if (input.runtimeOutcome === 'partially_completed') {
    return 'partially_updated';
  }
  return 'no_change';
}

function derivePropagationStatus(input: {
  record: RuntimeOutcomePropagationRecord;
  activationCount: number;
  coordinationCount: number;
  orchestrationCount: number;
  portfolioCount: number;
  resolvedCount: number;
  inconclusiveCount: number;
  hasDeferredEvent: boolean;
  hasFailedEvent: boolean;
  hasConflictReconciliation: boolean;
}): RuntimeOutcomePropagationStatus {
  if (input.hasFailedEvent || input.record.propagationClass === 'runtime_failed') {
    return 'failed';
  }
  if (input.hasConflictReconciliation) {
    return 'blocked';
  }
  if (input.hasDeferredEvent || input.record.propagationClass === 'runtime_deferred') {
    return 'deferred';
  }
  if (input.record.propagationClass === 'runtime_inconclusive' || input.inconclusiveCount > 0) {
    return 'inconclusive';
  }

  const total = input.activationCount + input.coordinationCount + input.orchestrationCount + input.portfolioCount;
  if (total === 0) {
    return 'pending';
  }
  if (input.resolvedCount === total) {
    return 'applied';
  }
  if (input.resolvedCount > 0) {
    return 'partially_applied';
  }
  return 'pending';
}

function derivePropagationOutcome(input: {
  status: RuntimeOutcomePropagationStatus;
  record: RuntimeOutcomePropagationRecord;
}): RuntimeOutcomePropagationOutcome {
  if (input.status === 'failed') {
    return 'failed';
  }
  if (input.status === 'blocked') {
    return 'blocked';
  }
  if (input.status === 'deferred') {
    return 'deferred';
  }
  if (input.status === 'inconclusive') {
    return 'inconclusive';
  }
  if (input.status === 'partially_applied') {
    return 'partially_updated';
  }
  if (input.status === 'applied') {
    return input.record.propagationClass === 'runtime_pending' ? 'no_change' : 'upstream_updated';
  }
  return 'no_change';
}

function projectFromRuntime(input: {
  runtime: ReturnType<ActivationRuntimeIntegrationProjectionEngine['projectOne']>;
  activationProjection: MissionExecutionActivationProjectionEngine;
  coordinationProjection: MissionExecutionCoordinationProjectionEngine;
  orchestrationProjection: MissionControlOrchestrationProjectionEngine;
  portfolioProjection: MissionPortfolioProjectionEngine;
  historyStore: RuntimeOutcomePropagationHistoryStore;
}): RuntimeOutcomePropagationProjection {
  const record = createRuntimeOutcomePropagationRecord({
    activationDispatchAttemptId: input.runtime.activationDispatchAttemptId,
    executionActivationRecordId: input.runtime.executionActivationRecordId,
    executionRequestRecordId: input.runtime.dispatchAttempt.executionRequestRecordId,
    runtimeStatus: input.runtime.status.status,
    outcome: deriveRecordOutcomeFromRuntime({ runtimeOutcome: input.runtime.outcome.outcome }),
  });

  const activation = input.activationProjection.projectOne({
    executionActivationRecordId: input.runtime.executionActivationRecordId,
  });

  const activationPropagationSummaries = [createActivationLifecyclePropagation({
    runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
    executionActivationRecordId: input.runtime.executionActivationRecordId,
    runtimeStatus: input.runtime.status.status,
    reasonTokens: uniqueSortedStrings([
      ...input.runtime.status.reasonTokens,
      ...activation.status.reasonTokens,
    ]),
  })];

  const coordinationSummaries = input.coordinationProjection.projectAll()
    .filter((entry) => entry.executionRequestSummaries.some(
      (request) => request.executionRequestRecordId === input.runtime.dispatchAttempt.executionRequestRecordId
    ))
    .map((entry) => createExecutionCoordinationPropagation({
      runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
      missionExecutionCoordinationPlanId: entry.missionExecutionCoordinationPlanId,
      coordinationStatus: entry.status.status,
      coordinationOutcome: entry.outcome.outcome,
      reasonTokens: uniqueSortedStrings([
        ...input.runtime.reconciliationSummaries.flatMap((summary) => summary.reasonTokens),
        ...entry.status.reasonTokens,
      ]),
    }))
    .sort((left, right) => left.executionCoordinationPropagationId.localeCompare(right.executionCoordinationPropagationId));

  const coordinationPlanIds = uniqueSortedStrings(
    coordinationSummaries.map((entry) => entry.missionExecutionCoordinationPlanId)
  );

  const orchestrationSummaries = input.orchestrationProjection.projectAll()
    .filter((entry) => {
      const coordinationForPlan = input.coordinationProjection.projectAll().find(
        (coordination) => coordination.missionControlInterventionPlanId === entry.missionControlInterventionPlanId
      );
      return Boolean(coordinationForPlan && coordinationPlanIds.includes(coordinationForPlan.missionExecutionCoordinationPlanId));
    })
    .map((entry) => createMissionOrchestrationPropagation({
      runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
      missionControlInterventionPlanId: entry.missionControlInterventionPlanId,
      orchestrationState: entry.interventionPlan.state,
      orchestrationOutcome: entry.orchestrationOutcome.outcome,
      reasonTokens: uniqueSortedStrings([
        ...entry.orchestrationOutcome.reasonTokens,
        ...entry.priorityPosture.reasonTokens,
      ]),
    }))
    .sort((left, right) => left.missionOrchestrationPropagationId.localeCompare(right.missionOrchestrationPropagationId));

  const planById = new Map(input.orchestrationProjection.projectAll().map((entry) => [entry.missionControlInterventionPlanId, entry]));
  const linkedPortfolioIds = uniqueSortedStrings(
    orchestrationSummaries.flatMap((entry) => planById.get(entry.missionControlInterventionPlanId)?.interventionPlan.portfolioIds ?? [])
  );

  const portfolioById = new Map(input.portfolioProjection.projectAll().map((entry) => [entry.missionPortfolioId, entry]));

  const missionPortfolioPropagationSummaries = linkedPortfolioIds
    .map((missionPortfolioId) => {
      const portfolio = portfolioById.get(missionPortfolioId);
      if (!portfolio) {
        return null;
      }

      return createMissionPortfolioStatePropagation({
        runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
        missionPortfolioId,
        runtimeStatus: input.runtime.status.status,
        healthState: portfolio.healthState,
        readinessState: portfolio.readinessState,
        reasonTokens: uniqueSortedStrings([
          `governance_posture:${portfolio.governancePosture}`,
          ...portfolio.blockingClusters.map((cluster) => cluster.portfolioBlockingClusterId),
        ]),
      });
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.missionPortfolioStatePropagationId.localeCompare(right.missionPortfolioStatePropagationId));

  const propagationHistory = input.historyStore.load({
    runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
  });

  const resolvedCount = [
    ...activationPropagationSummaries,
    ...coordinationSummaries,
    ...orchestrationSummaries,
    ...missionPortfolioPropagationSummaries,
  ].filter((entry) => entry.state === 'resolved').length;

  const inconclusiveCount = [
    ...activationPropagationSummaries,
    ...coordinationSummaries,
    ...orchestrationSummaries,
    ...missionPortfolioPropagationSummaries,
  ].filter((entry) => entry.state === 'inconclusive').length;

  const status = derivePropagationStatus({
    record,
    activationCount: activationPropagationSummaries.length,
    coordinationCount: coordinationSummaries.length,
    orchestrationCount: orchestrationSummaries.length,
    portfolioCount: missionPortfolioPropagationSummaries.length,
    resolvedCount,
    inconclusiveCount,
    hasDeferredEvent: propagationHistory.entries.some((entry) => entry.eventType === 'runtime_outcome_propagation_deferred'),
    hasFailedEvent: propagationHistory.entries.some((entry) => entry.eventType === 'runtime_outcome_propagation_failed'),
    hasConflictReconciliation: input.runtime.reconciliationSummaries.some((entry) => entry.reconciliationClass === 'feedback_conflict'),
  });

  const outcome = derivePropagationOutcome({
    status,
    record,
  });

  const linkedExecutionAttemptIds = uniqueSortedStrings([
    ...input.runtime.linkedExecutionAttemptIds,
    ...activation.linkedExecutionAttemptIds,
    ...coordinationPlanIds.flatMap((planId) => input.coordinationProjection.projectOne({ missionExecutionCoordinationPlanId: planId }).linkedExecutionAttemptIds),
  ]);

  const statusPreview = {
    runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
    activationDispatchAttemptId: record.activationDispatchAttemptId,
    executionActivationRecordId: record.executionActivationRecordId,
    executionRequestRecordId: record.executionRequestRecordId,
    status,
    outcome,
    targetLayer: record.targetLayer,
  } as Record<string, unknown>;

  const reportPreview = {
    record,
    activationPropagationSummaries,
    executionCoordinationPropagationSummaries: coordinationSummaries,
    missionOrchestrationPropagationSummaries: orchestrationSummaries,
    missionPortfolioPropagationSummaries,
    status,
    outcome,
    linkedExecutionAttemptIds,
    propagationHistory,
  } as Record<string, unknown>;

  return {
    runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
    record,
    activationPropagationSummaries,
    executionCoordinationPropagationSummaries: coordinationSummaries,
    missionOrchestrationPropagationSummaries: orchestrationSummaries,
    missionPortfolioPropagationSummaries,
    status,
    outcome,
    linkedExecutionAttemptIds,
    propagationHistory,
    statusPreview,
    reportPreview,
  };
}

export function createRuntimeOutcomePropagationProjection(options: {
  runtimeProjection?: ActivationRuntimeIntegrationProjectionEngine;
  activationProjection?: MissionExecutionActivationProjectionEngine;
  coordinationProjection?: MissionExecutionCoordinationProjectionEngine;
  orchestrationProjection?: MissionControlOrchestrationProjectionEngine;
  portfolioProjection?: MissionPortfolioProjectionEngine;
  historyStore?: RuntimeOutcomePropagationHistoryStore;
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
  const runtimeProjection = options.runtimeProjection ?? createActivationRuntimeIntegrationProjection({
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

  const activationProjection = options.activationProjection ?? createMissionExecutionActivationProjection({
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

  const coordinationProjection = options.coordinationProjection ?? createMissionExecutionCoordinationProjection({
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

  const orchestrationProjection = options.orchestrationProjection ?? createMissionControlOrchestrationProjection({
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

  const portfolioProjection = options.portfolioProjection ?? createMissionPortfolioProjection({
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

  const historyStore = options.historyStore ?? createRuntimeOutcomePropagationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectAll(): RuntimeOutcomePropagationProjection[] {
    const byId = new Map<string, RuntimeOutcomePropagationProjection>();

    for (const runtime of runtimeProjection.projectAll()) {
      const projection = projectFromRuntime({
        runtime,
        activationProjection,
        coordinationProjection,
        orchestrationProjection,
        portfolioProjection,
        historyStore,
      });
      byId.set(projection.runtimeOutcomePropagationRecordId, projection);
    }

    return Array.from(byId.values())
      .sort((left, right) => left.runtimeOutcomePropagationRecordId.localeCompare(right.runtimeOutcomePropagationRecordId));
  }

  function projectOne(input: { runtimeOutcomePropagationRecordId: string }): RuntimeOutcomePropagationProjection {
    const found = projectAll().find((entry) => entry.runtimeOutcomePropagationRecordId === input.runtimeOutcomePropagationRecordId);
    if (!found) {
      throw new Error('RUNTIME_OUTCOME_PROPAGATION_RECORD_NOT_FOUND');
    }
    return found;
  }

  function listPropagationRecords() {
    return projectAll().map((entry) => ({
      runtimeOutcomePropagationRecordId: entry.runtimeOutcomePropagationRecordId,
      activationDispatchAttemptId: entry.record.activationDispatchAttemptId,
      executionActivationRecordId: entry.record.executionActivationRecordId,
      executionRequestRecordId: entry.record.executionRequestRecordId,
      propagationClass: entry.record.propagationClass,
      targetLayer: entry.record.targetLayer,
      state: entry.record.state,
      status: entry.status,
      outcome: entry.outcome,
    }));
  }

  return {
    projectAll,
    projectOne,
    listPropagationRecords,
  };
}

export type RuntimeOutcomePropagationProjectionEngine = ReturnType<typeof createRuntimeOutcomePropagationProjection>;
