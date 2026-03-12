import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createMissionActivationEvaluator,
  type MissionActivationEvaluator,
} from './mission-activation-evaluator.ts';
import {
  createMissionActivationHistoryStore,
  resolveMissionActivationArtifactPaths,
  type MissionActivationHistoryStore,
} from './mission-activation-history-store.ts';
import { getMissionActivationPolicy } from './mission-activation-policies.ts';
import { deriveMissionActivationStatus } from './mission-activation-status.ts';
import type { MissionActivationProjection } from './mission-activation-types.ts';

function computeHistoryDigest(input: { entries: unknown[] }): string {
  return sha256(canonicalStringify(input.entries));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createMissionActivationProjection(options: {
  evaluator?: MissionActivationEvaluator;
  historyStore?: MissionActivationHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  dagDefinitionsDir?: string;
  missionDAGArtifactsRoot?: string;
  activationArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createMissionActivationEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionActivationHistoryStore({
    artifactsRoot: options.activationArtifactsRoot,
  });

  function projectOne(input: {
    missionId: string;
    activationPolicyId?: string;
  }): MissionActivationProjection {
    const evaluated = evaluator.evaluateActivation(input);
    const history = historyStore.load({
      activationDecisionId: evaluated.activationDecision.activationDecisionId,
      missionId: evaluated.activationDecision.missionId,
    });

    const policy = getMissionActivationPolicy(evaluated.activationDecision.activationPolicyId);
    const recomputedStatus = deriveMissionActivationStatus({
      policy,
      activationMode: evaluated.activationDecision.activationMode,
      preconditionResults: evaluated.activationDecision.preconditionResults,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest({ entries: history.entries });
    const artifactPaths = resolveMissionActivationArtifactPaths({
      activationDecisionId: evaluated.activationDecision.activationDecisionId,
      rootDir: options.activationArtifactsRoot,
    });

    const statusPreview = {
      activationDecisionId: evaluated.activationDecision.activationDecisionId,
      missionId: evaluated.activationDecision.missionId,
      assignmentDecisionId: evaluated.activationDecision.assignmentDecisionId,
      selectedTeamId: evaluated.activationDecision.selectedTeamId,
      activationPolicyId: evaluated.activationDecision.activationPolicyId,
      activationMode: evaluated.activationDecision.activationMode,
      activationState: recomputedStatus.activationState,
      executionReadinessState: recomputedStatus.executionReadinessState,
      blockingReasons: recomputedStatus.blockingReasons,
      limitations: uniqueSorted([
        ...evaluated.activationDecision.limitations,
        ...recomputedStatus.limitations,
      ]),
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated.activationDecision,
      activationState: recomputedStatus.activationState,
      executionReadinessState: recomputedStatus.executionReadinessState,
      blockingReasons: recomputedStatus.blockingReasons,
      limitations: uniqueSorted([
        ...evaluated.activationDecision.limitations,
        ...recomputedStatus.limitations,
      ]),
      activationReasonTokens: recomputedStatus.activationReasonTokens,
      handoffContract: {
        ...evaluated.activationDecision.handoffContract,
        executionPreconditionsSatisfied: recomputedStatus.executionReadinessState === 'ready',
        remainingBlockers: recomputedStatus.blockingReasons,
        runtimeInvocationSupported: false,
      },
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated.activationDecision,
      activationState: recomputedStatus.activationState,
      executionReadinessState: recomputedStatus.executionReadinessState,
      blockingReasons: recomputedStatus.blockingReasons,
      limitations: uniqueSorted([
        ...evaluated.activationDecision.limitations,
        ...recomputedStatus.limitations,
      ]),
      activationReasonTokens: recomputedStatus.activationReasonTokens,
      handoffContract: {
        ...evaluated.activationDecision.handoffContract,
        executionPreconditionsSatisfied: recomputedStatus.executionReadinessState === 'ready',
        remainingBlockers: recomputedStatus.blockingReasons,
        runtimeInvocationSupported: false,
      },
      historyDigest,
      historySummary: {
        totalEvents: history.entries.length,
        ...(history.entries[history.entries.length - 1]
          ? { lastEventType: history.entries[history.entries.length - 1].eventType }
          : {}),
        ...(history.entries[history.entries.length - 1]
          ? { lastEventDedupeKey: history.entries[history.entries.length - 1].eventDedupeKey }
          : {}),
      },
      statusPreview,
      reportPreview,
      artifactPaths,
    };
  }

  function projectAll(input: { activationPolicyId?: string } = {}): MissionActivationProjection[] {
    return evaluator
      .evaluateAllActivations({ activationPolicyId: input.activationPolicyId })
      .map((entry) => projectOne({
        missionId: entry.activationDecision.missionId,
        activationPolicyId: entry.activationDecision.activationPolicyId,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function summarizeList(input: { activationPolicyId?: string } = {}) {
    return projectAll(input)
      .map((entry) => ({
        activationDecisionId: entry.activationDecisionId,
        missionId: entry.missionId,
        assignmentDecisionId: entry.assignmentDecisionId,
        selectedTeamId: entry.selectedTeamId,
        activationPolicyId: entry.activationPolicyId,
        activationMode: entry.activationMode,
        activationState: entry.activationState,
        executionReadinessState: entry.executionReadinessState,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type MissionActivationProjectionEngine = ReturnType<typeof createMissionActivationProjection>;
