import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createExecutionAttemptEvaluator,
  type ExecutionAttemptEvaluator,
} from './execution-attempt-evaluator.ts';
import {
  createExecutionAttemptHistoryStore,
  resolveExecutionAttemptArtifactPaths,
  type ExecutionAttemptHistoryStore,
} from './execution-attempt-history-store.ts';
import type {
  ExecutionAttemptInputs,
  MissionExecutionAttemptProjection,
} from './execution-attempt-types.ts';

function computeHistoryDigest(input: { entries: unknown[] }): string {
  return sha256(canonicalStringify(input.entries));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readAttemptInputs(value: unknown): ExecutionAttemptInputs | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const targetRuntimeKind = asString(value.targetRuntimeKind);
  const inputParameters = isRecord(value.inputParameters) ? value.inputParameters : null;
  const environmentContext = isRecord(value.environmentContext) ? value.environmentContext : null;
  const resourceExpectations = isRecord(value.resourceExpectations) ? value.resourceExpectations : null;

  if (!targetRuntimeKind || !inputParameters || !environmentContext || !resourceExpectations) {
    return undefined;
  }

  const toStringRecord = (record: Record<string, unknown>): Record<string, string> => Object.fromEntries(
    Object.entries(record)
      .flatMap(([key, entry]) => (typeof entry === 'string' ? [[key, entry]] : []))
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    targetRuntimeKind,
    inputParameters: toStringRecord(inputParameters),
    environmentContext: toStringRecord(environmentContext),
    resourceExpectations: toStringRecord(resourceExpectations),
  };
}

function resolveProjectSeedByAttemptId(input: {
  executionAttemptId: string;
  historyStore: ExecutionAttemptHistoryStore;
}): {
  runtimeEnvelopeId: string;
  attemptIndex: number;
  attemptInputs?: ExecutionAttemptInputs;
  executionAttemptPolicyId?: string;
} | null {
  const history = input.historyStore.loadByExecutionAttemptId({ executionAttemptId: input.executionAttemptId });
  if (!history) {
    return null;
  }

  const createdEvent = history.entries.find((entry) => entry.eventType === 'execution_attempt_created');
  if (!createdEvent || !isRecord(createdEvent.payload)) {
    return null;
  }

  const runtimeEnvelopeId = asString(createdEvent.payload.runtimeEnvelopeId) ?? history.runtimeEnvelopeId;
  const attemptIndexRaw = createdEvent.payload.attemptIndex;
  const attemptIndex = typeof attemptIndexRaw === 'number' && Number.isInteger(attemptIndexRaw) && attemptIndexRaw > 0
    ? attemptIndexRaw
    : 1;

  if (!runtimeEnvelopeId) {
    return null;
  }

  const attemptInputs = readAttemptInputs(createdEvent.payload.attemptInputs);
  const executionAttemptPolicyId = asString(createdEvent.payload.executionAttemptPolicyId) ?? undefined;

  return {
    runtimeEnvelopeId,
    attemptIndex,
    ...(attemptInputs ? { attemptInputs } : {}),
    ...(executionAttemptPolicyId ? { executionAttemptPolicyId } : {}),
  };
}

export function createExecutionAttemptProjection(options: {
  evaluator?: ExecutionAttemptEvaluator;
  historyStore?: ExecutionAttemptHistoryStore;
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
} = {}) {
  const evaluator = options.evaluator ?? createExecutionAttemptEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionAttemptHistoryStore({
    artifactsRoot: options.executionAttemptArtifactsRoot,
  });

  function projectOne(input: {
    executionAttemptId?: string;
    runtimeEnvelopeId?: string;
    attemptIndex?: number;
    attemptInputs?: ExecutionAttemptInputs;
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
  }): MissionExecutionAttemptProjection {
    let runtimeEnvelopeId = input.runtimeEnvelopeId;
    let attemptIndex = input.attemptIndex;
    let attemptInputs = input.attemptInputs;
    let executionAttemptPolicyId = input.executionAttemptPolicyId;

    if (!runtimeEnvelopeId && input.executionAttemptId) {
      const seed = resolveProjectSeedByAttemptId({
        executionAttemptId: input.executionAttemptId,
        historyStore,
      });

      if (seed) {
        runtimeEnvelopeId = seed.runtimeEnvelopeId;
        attemptIndex = seed.attemptIndex;
        attemptInputs = seed.attemptInputs;
        executionAttemptPolicyId = seed.executionAttemptPolicyId;
      }
    }

    if (!runtimeEnvelopeId) {
      throw new Error('EXECUTION_ATTEMPT_NOT_FOUND');
    }

    const evaluatedInitial = evaluator.evaluateExecutionAttempt({
      runtimeEnvelopeId,
      attemptIndex,
      attemptInputs,
      executionAttemptPolicyId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });

    if (input.executionAttemptId && input.executionAttemptId !== evaluatedInitial.executionAttempt.executionAttemptId) {
      throw new Error('EXECUTION_ATTEMPT_NOT_FOUND');
    }

    const history = historyStore.load({
      executionAttemptId: evaluatedInitial.executionAttempt.executionAttemptId,
      runtimeEnvelopeId: evaluatedInitial.executionAttempt.runtimeEnvelopeId,
      executionContractId: evaluatedInitial.executionAttempt.executionContractId,
      missionId: evaluatedInitial.executionAttempt.missionId,
    });

    const evaluated = evaluator.evaluateExecutionAttempt({
      runtimeEnvelopeId: evaluatedInitial.executionAttempt.runtimeEnvelopeId,
      attemptIndex: evaluatedInitial.executionAttempt.attemptIndex,
      attemptInputs: evaluatedInitial.executionAttempt.attemptInputs,
      executionAttemptPolicyId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest({ entries: history.entries });
    const artifactPaths = resolveExecutionAttemptArtifactPaths({
      executionAttemptId: evaluated.executionAttempt.executionAttemptId,
      rootDir: options.executionAttemptArtifactsRoot,
    });

    const statusPreview = {
      executionAttemptId: evaluated.executionAttempt.executionAttemptId,
      runtimeEnvelopeId: evaluated.executionAttempt.runtimeEnvelopeId,
      executionContractId: evaluated.executionAttempt.executionContractId,
      missionId: evaluated.executionAttempt.missionId,
      attemptIndex: evaluated.executionAttempt.attemptIndex,
      executionPolicyId: evaluated.executionAttempt.executionPolicyId,
      attemptState: evaluated.executionAttempt.attemptState,
      attemptLifecycleState: evaluated.executionAttempt.attemptLifecycleState,
      blockers: evaluated.executionAttempt.blockers,
      limitations: evaluated.executionAttempt.limitations,
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated.executionAttempt,
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated.executionAttempt,
      blockers: uniqueSorted(evaluated.executionAttempt.blockers),
      limitations: uniqueSorted(evaluated.executionAttempt.limitations),
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

  function projectAll(input: {
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
  } = {}): MissionExecutionAttemptProjection[] {
    return evaluator
      .evaluateAllExecutionAttempts({
        executionAttemptPolicyId: input.executionAttemptPolicyId,
        runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
      })
      .map((entry) => projectOne({
        runtimeEnvelopeId: entry.executionAttempt.runtimeEnvelopeId,
        attemptIndex: entry.executionAttempt.attemptIndex,
        attemptInputs: entry.executionAttempt.attemptInputs,
        executionAttemptPolicyId: input.executionAttemptPolicyId,
        runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
      }))
      .sort((left, right) => left.executionAttemptId.localeCompare(right.executionAttemptId));
  }

  function summarizeList(input: {
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
  } = {}) {
    return projectAll(input)
      .map((entry) => ({
        executionAttemptId: entry.executionAttemptId,
        runtimeEnvelopeId: entry.runtimeEnvelopeId,
        executionContractId: entry.executionContractId,
        missionId: entry.missionId,
        attemptIndex: entry.attemptIndex,
        attemptState: entry.attemptState,
        attemptLifecycleState: entry.attemptLifecycleState,
      }))
      .sort((left, right) => left.executionAttemptId.localeCompare(right.executionAttemptId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type ExecutionAttemptProjectionEngine = ReturnType<typeof createExecutionAttemptProjection>;
