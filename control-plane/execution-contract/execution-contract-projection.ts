import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createExecutionContractEvaluator,
  type ExecutionContractEvaluator,
} from './execution-contract-evaluator.ts';
import {
  createExecutionContractHistoryStore,
  resolveExecutionContractArtifactPaths,
  type ExecutionContractHistoryStore,
} from './execution-contract-history-store.ts';
import { getExecutionContractPolicy } from './execution-contract-policies.ts';
import { deriveExecutionContractStatus } from './execution-contract-status.ts';
import type { MissionExecutionContractProjection } from './execution-contract-types.ts';

function computeHistoryDigest(input: { entries: unknown[] }): string {
  return sha256(canonicalStringify(input.entries));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createExecutionContractProjection(options: {
  evaluator?: ExecutionContractEvaluator;
  historyStore?: ExecutionContractHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createExecutionContractEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionContractHistoryStore({
    artifactsRoot: options.executionContractArtifactsRoot,
  });

  function projectOne(input: {
    missionId: string;
    executionPolicyId?: string;
  }): MissionExecutionContractProjection {
    const evaluated = evaluator.evaluateExecutionContract(input);
    const history = historyStore.load({
      executionContractId: evaluated.executionContract.executionContractId,
      missionId: evaluated.executionContract.missionId,
    });

    const policy = getExecutionContractPolicy(evaluated.executionContract.executionPolicyId);
    const recomputedStatus = deriveExecutionContractStatus({
      policy,
      preconditionResults: evaluated.executionContract.preconditionResults,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest({ entries: history.entries });
    const artifactPaths = resolveExecutionContractArtifactPaths({
      executionContractId: evaluated.executionContract.executionContractId,
      rootDir: options.executionContractArtifactsRoot,
    });

    const statusPreview = {
      executionContractId: evaluated.executionContract.executionContractId,
      missionId: evaluated.executionContract.missionId,
      assignmentDecisionId: evaluated.executionContract.assignmentDecisionId,
      activationDecisionId: evaluated.executionContract.activationDecisionId,
      selectedTeamId: evaluated.executionContract.selectedTeamId,
      executionPolicyId: evaluated.executionContract.executionPolicyId,
      contractState: recomputedStatus.contractState,
      executionEligibilityState: recomputedStatus.executionEligibilityState,
      executionTarget: evaluated.executionContract.executionTarget,
      blockingReasons: recomputedStatus.blockingReasons,
      limitations: uniqueSorted([
        ...evaluated.executionContract.limitations,
        ...recomputedStatus.limitations,
      ]),
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated.executionContract,
      contractState: recomputedStatus.contractState,
      executionEligibilityState: recomputedStatus.executionEligibilityState,
      remainingBlockers: recomputedStatus.blockingReasons,
      limitations: uniqueSorted([
        ...evaluated.executionContract.limitations,
        ...recomputedStatus.limitations,
      ]),
      reasonTokens: uniqueSorted(recomputedStatus.reasonTokens),
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated.executionContract,
      contractState: recomputedStatus.contractState,
      executionEligibilityState: recomputedStatus.executionEligibilityState,
      remainingBlockers: uniqueSorted(recomputedStatus.blockingReasons),
      limitations: uniqueSorted([
        ...evaluated.executionContract.limitations,
        ...recomputedStatus.limitations,
      ]),
      reasonTokens: uniqueSorted(recomputedStatus.reasonTokens),
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

  function projectAll(input: { executionPolicyId?: string } = {}): MissionExecutionContractProjection[] {
    return evaluator
      .evaluateAllExecutionContracts({ executionPolicyId: input.executionPolicyId })
      .map((entry) => projectOne({
        missionId: entry.executionContract.missionId,
        executionPolicyId: entry.executionContract.executionPolicyId,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function summarizeList(input: { executionPolicyId?: string } = {}) {
    return projectAll(input)
      .map((entry) => ({
        executionContractId: entry.executionContractId,
        missionId: entry.missionId,
        assignmentDecisionId: entry.assignmentDecisionId,
        activationDecisionId: entry.activationDecisionId,
        selectedTeamId: entry.selectedTeamId,
        executionPolicyId: entry.executionPolicyId,
        contractState: entry.contractState,
        executionEligibilityState: entry.executionEligibilityState,
        executionTarget: entry.executionTarget,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type ExecutionContractProjectionEngine = ReturnType<typeof createExecutionContractProjection>;
