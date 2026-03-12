import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createRuntimeEnvelopeEvaluator,
  type RuntimeEnvelopeEvaluator,
} from './runtime-envelope-evaluator.ts';
import {
  createRuntimeEnvelopeHistoryStore,
  resolveRuntimeEnvelopeArtifactPaths,
  type RuntimeEnvelopeHistoryStore,
} from './runtime-envelope-history-store.ts';
import type { MissionRuntimeEnvelopeProjection } from './runtime-envelope-types.ts';

function computeHistoryDigest(input: { entries: unknown[] }): string {
  return sha256(canonicalStringify(input.entries));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createRuntimeEnvelopeProjection(options: {
  evaluator?: RuntimeEnvelopeEvaluator;
  historyStore?: RuntimeEnvelopeHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createRuntimeEnvelopeEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createRuntimeEnvelopeHistoryStore({
    artifactsRoot: options.runtimeEnvelopeArtifactsRoot,
  });

  function projectOne(input: {
    executionContractId?: string;
    runtimeEnvelopeId?: string;
    runtimeEnvelopePolicyId?: string;
  }): MissionRuntimeEnvelopeProjection {
    let executionContractId = input.executionContractId;
    if (!executionContractId && input.runtimeEnvelopeId) {
      executionContractId = evaluator.resolveExecutionContractIdFromEnvelopeId({
        runtimeEnvelopeId: input.runtimeEnvelopeId,
        runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
      });
    }

    if (!executionContractId) {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    }

    const evaluatedInitial = evaluator.evaluateRuntimeEnvelope({
      executionContractId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });

    const history = historyStore.load({
      runtimeEnvelopeId: evaluatedInitial.runtimeEnvelope.runtimeEnvelopeId,
      executionContractId: evaluatedInitial.runtimeEnvelope.executionContractId,
      missionId: evaluatedInitial.runtimeEnvelope.missionId,
    });

    const evaluated = evaluator.evaluateRuntimeEnvelope({
      executionContractId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest({ entries: history.entries });
    const artifactPaths = resolveRuntimeEnvelopeArtifactPaths({
      runtimeEnvelopeId: evaluated.runtimeEnvelope.runtimeEnvelopeId,
      rootDir: options.runtimeEnvelopeArtifactsRoot,
    });

    const statusPreview = {
      runtimeEnvelopeId: evaluated.runtimeEnvelope.runtimeEnvelopeId,
      executionContractId: evaluated.runtimeEnvelope.executionContractId,
      missionId: evaluated.runtimeEnvelope.missionId,
      selectedTeamId: evaluated.runtimeEnvelope.selectedTeamId,
      executionTarget: evaluated.runtimeEnvelope.executionTarget,
      envelopeState: evaluated.runtimeEnvelope.envelopeState,
      envelopeEligibility: evaluated.runtimeEnvelope.envelopeEligibility,
      blockers: evaluated.runtimeEnvelope.blockers,
      limitations: evaluated.runtimeEnvelope.limitations,
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated.runtimeEnvelope,
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated.runtimeEnvelope,
      limitations: uniqueSorted(evaluated.runtimeEnvelope.limitations),
      blockers: uniqueSorted(evaluated.runtimeEnvelope.blockers),
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

  function projectAll(input: { runtimeEnvelopePolicyId?: string } = {}): MissionRuntimeEnvelopeProjection[] {
    return evaluator
      .evaluateAllRuntimeEnvelopes({ runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId })
      .map((entry) => projectOne({
        executionContractId: entry.runtimeEnvelope.executionContractId,
        runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function summarizeList(input: { runtimeEnvelopePolicyId?: string } = {}) {
    return projectAll(input)
      .map((entry) => ({
        runtimeEnvelopeId: entry.runtimeEnvelopeId,
        executionContractId: entry.executionContractId,
        missionId: entry.missionId,
        selectedTeamId: entry.selectedTeamId,
        executionTarget: entry.executionTarget,
        envelopeState: entry.envelopeState,
        envelopeEligibility: entry.envelopeEligibility,
      }))
      .sort((left, right) => left.runtimeEnvelopeId.localeCompare(right.runtimeEnvelopeId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type RuntimeEnvelopeProjectionEngine = ReturnType<typeof createRuntimeEnvelopeProjection>;
