import {
  createMissionCoordinationProjection,
  type MissionCoordinationProjectionEngine,
} from './mission-coordination-projection.ts';
import {
  createMissionReviewProjection,
  type MissionReviewProjectionEngine,
} from './mission-review-projection.ts';
import {
  createMissionRunProjection,
  type MissionRunProjectionEngine,
} from './mission-run-projection.ts';
import { deriveMissionPortfolioBlockingClusters } from './mission-portfolio-blocking.ts';
import { deriveMissionPortfolioGovernancePosture } from './mission-portfolio-governance.ts';
import {
  deriveMissionPortfolioMembership,
  summarizeMissionPortfolioMembership,
} from './mission-portfolio-membership.ts';
import { deriveMissionPortfolioHealthState } from './mission-portfolio-health.ts';
import { deriveMissionPortfolioPriorityDistribution } from './mission-portfolio-priority.ts';
import { deriveMissionPortfolioReadinessState } from './mission-portfolio-readiness.ts';
import {
  createMissionPortfolioRegistry,
  type MissionPortfolioRegistry,
} from './mission-portfolio-registry.ts';
import type {
  MissionPortfolioDefinition,
  MissionPortfolioProjection,
} from './mission-portfolio-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createMissionPortfolioProjection(options: {
  registry?: MissionPortfolioRegistry;
  missionRunProjection?: MissionRunProjectionEngine;
  missionCoordinationProjection?: MissionCoordinationProjectionEngine;
  missionReviewProjection?: MissionReviewProjectionEngine;
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
  const missionRunProjection = options.missionRunProjection ?? createMissionRunProjection({
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

  const missionCoordinationProjection = options.missionCoordinationProjection ?? createMissionCoordinationProjection({
    missionRunProjection,
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

  const missionReviewProjection = options.missionReviewProjection ?? createMissionReviewProjection({
    missionRunProjection,
    missionCoordinationProjection,
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

  const registry = options.registry ?? createMissionPortfolioRegistry();

  function projectDefinition(definition: MissionPortfolioDefinition): MissionPortfolioProjection {
    const runs = missionRunProjection.projectAll()
      .sort((left, right) => left.missionRunId.localeCompare(right.missionRunId));
    const missionRunIds = runs.map((entry) => entry.missionRunId);

    const runById = new Map(runs.map((run) => [run.missionRunId, run]));
    const coordinationById = new Map(missionRunIds.map((missionRunId) => [missionRunId, missionCoordinationProjection.projectOne({ missionRunId })]));
    const reviewById = new Map(missionRunIds.map((missionRunId) => [missionRunId, missionReviewProjection.projectOne({ missionRunId })]));

    const blockedMissionRunIds = new Set<string>(
      missionRunIds.filter((missionRunId) => {
        const coordination = coordinationById.get(missionRunId);
        return Boolean(
          coordination
          && (
            coordination.coordinationState === 'blocked_by_dependency'
            || coordination.coordinationState === 'blocked_by_escalation'
            || coordination.blockingMissionRunIds.length > 0
          )
        );
      })
    );

    const governanceImpactedMissionRunIds = new Set<string>(
      missionRunIds.filter((missionRunId) => {
        const review = reviewById.get(missionRunId);
        return Boolean(
          review
          && (
            review.governanceStatus !== 'no_review_required'
            || review.decisionOutcome !== 'pending'
          )
        );
      })
    );

    const missionPriorities = new Map<string, string>(
      missionRunIds.map((missionRunId) => [
        missionRunId,
        coordinationById.get(missionRunId)?.priority ?? 'normal',
      ])
    );

    const memberships = deriveMissionPortfolioMembership({
      portfolio: definition,
      missionRunIds,
      missionPriorities,
      blockedMissionRunIds,
      governanceImpactedMissionRunIds,
    });

    const includedMissionRunIds = memberships
      .filter((entry) => entry.state === 'active')
      .map((entry) => entry.missionRunId)
      .sort((left, right) => left.localeCompare(right));

    const readinessState = deriveMissionPortfolioReadinessState({
      signals: includedMissionRunIds.map((missionRunId) => {
        const run = runById.get(missionRunId);
        const coordination = coordinationById.get(missionRunId);
        const review = reviewById.get(missionRunId);

        return {
          missionRunId,
          priority: coordination?.priority ?? 'normal',
          operationalState: run?.operationalState ?? 'inconclusive',
          completionState: run?.completionState ?? 'inconclusive',
          healthState: run?.healthState ?? 'inconclusive',
          coordinationState: coordination?.coordinationState ?? 'inconclusive',
          governanceStatus: review?.governanceStatus ?? 'inconclusive',
          hasBlockingDependencies: (coordination?.blockingMissionRunIds.length ?? 0) > 0,
        };
      }),
    });

    const blockingClusters = deriveMissionPortfolioBlockingClusters({
      missionPortfolioId: definition.missionPortfolioId,
      signals: includedMissionRunIds.map((missionRunId) => {
        const coordination = coordinationById.get(missionRunId);
        const review = reviewById.get(missionRunId);

        return {
          missionRunId,
          coordinationState: coordination?.coordinationState ?? 'inconclusive',
          governanceStatus: review?.governanceStatus ?? 'inconclusive',
          priority: coordination?.priority ?? 'normal',
          blockingMissionRunIds: coordination?.blockingMissionRunIds ?? [],
          reasonTokens: uniqueSorted([
            ...(coordination?.dependencySummaries.flatMap((entry) => entry.blockingReasonTokens) ?? []),
            ...(review?.linkedDependencies ?? []),
          ]),
        };
      }),
    });

    const healthState = deriveMissionPortfolioHealthState({
      signals: includedMissionRunIds.map((missionRunId) => {
        const run = runById.get(missionRunId);
        return {
          missionRunId,
          operationalState: run?.operationalState ?? 'inconclusive',
          completionState: run?.completionState ?? 'inconclusive',
          healthState: run?.healthState ?? 'inconclusive',
        };
      }),
      blockingClusterCount: blockingClusters.length,
    });

    const governancePosture = deriveMissionPortfolioGovernancePosture({
      signals: includedMissionRunIds.map((missionRunId) => {
        const review = reviewById.get(missionRunId);
        return {
          missionRunId,
          governanceStatus: review?.governanceStatus ?? 'inconclusive',
          decisionOutcome: review?.decisionOutcome ?? 'inconclusive',
        };
      }),
    });

    const priorityDistribution = deriveMissionPortfolioPriorityDistribution({
      missionPriorities: includedMissionRunIds.map((missionRunId) => missionPriorities.get(missionRunId) ?? 'normal'),
    });

    const linkedEscalationSummaries = includedMissionRunIds
      .flatMap((missionRunId) => {
        const run = runById.get(missionRunId);
        return (run?.escalations ?? []).map((entry) => ({
          missionRunId,
          escalationId: entry.escalationId,
          escalationClass: entry.escalationClass,
          severity: entry.severity,
          state: entry.state,
        }));
      })
      .sort((left, right) => {
        const runCompare = left.missionRunId.localeCompare(right.missionRunId);
        if (runCompare !== 0) {
          return runCompare;
        }
        return left.escalationId.localeCompare(right.escalationId);
      });

    const linkedDecisionSummaries = includedMissionRunIds
      .flatMap((missionRunId) => {
        const review = reviewById.get(missionRunId);
        return (review?.decisionRecords ?? []).map((entry) => ({
          missionRunId,
          decisionRecordId: entry.decisionRecordId,
          decisionOutcome: entry.decisionOutcome,
          governanceStatus: review?.governanceStatus ?? 'inconclusive',
        }));
      })
      .sort((left, right) => {
        const runCompare = left.missionRunId.localeCompare(right.missionRunId);
        if (runCompare !== 0) {
          return runCompare;
        }
        return left.decisionRecordId.localeCompare(right.decisionRecordId);
      });

    const membershipSummaries = summarizeMissionPortfolioMembership({ memberships });

    const statusPreview = {
      missionPortfolioId: definition.missionPortfolioId,
      displayName: definition.displayName,
      portfolioType: definition.portfolioType,
      missionRunIds: includedMissionRunIds,
      membershipSummaries,
      readinessState,
      healthState,
      governancePosture,
      priorityDistribution,
      blockingClusterIds: blockingClusters.map((entry) => entry.portfolioBlockingClusterId),
    } as Record<string, unknown>;

    const reportPreview = {
      ...statusPreview,
      memberships,
      blockingClusters,
      linkedEscalationSummaries,
      linkedDecisionSummaries,
    } as Record<string, unknown>;

    return {
      missionPortfolioId: definition.missionPortfolioId,
      displayName: definition.displayName,
      portfolioType: definition.portfolioType,
      missionRunIds: includedMissionRunIds,
      memberships,
      membershipSummaries,
      readinessState,
      healthState,
      governancePosture,
      priorityDistribution,
      blockingClusters,
      linkedEscalationSummaries,
      linkedDecisionSummaries,
      statusPreview,
      reportPreview,
    };
  }

  function projectOne(input: { missionPortfolioId: string }): MissionPortfolioProjection {
    const definition = registry.getMissionPortfolio({ missionPortfolioId: input.missionPortfolioId });
    return projectDefinition(definition);
  }

  function projectAll(): MissionPortfolioProjection[] {
    return registry.listMissionPortfolios()
      .map((definition) => projectDefinition(definition))
      .sort((left, right) => left.missionPortfolioId.localeCompare(right.missionPortfolioId));
  }

  function summarizeList() {
    return projectAll().map((entry) => ({
      missionPortfolioId: entry.missionPortfolioId,
      displayName: entry.displayName,
      portfolioType: entry.portfolioType,
      readinessState: entry.readinessState,
      healthState: entry.healthState,
      governancePosture: entry.governancePosture,
      missionRunCount: entry.missionRunIds.length,
      blockingClusterCount: entry.blockingClusters.length,
    }));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type MissionPortfolioProjectionEngine = ReturnType<typeof createMissionPortfolioProjection>;
