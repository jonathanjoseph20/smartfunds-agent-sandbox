import {
  createExecutionAttemptEvaluator,
  type ExecutionAttemptEvaluator,
} from './execution-attempt-evaluator.ts';
import {
  createExecutionAttemptHistoryStore,
  type ExecutionAttemptHistoryStore,
} from './execution-attempt-history-store.ts';
import {
  createExecutionAttemptMaterializer,
  type ExecutionAttemptMaterializer,
} from './execution-attempt-materializer.ts';
import {
  createExecutionAttemptProjection,
  type ExecutionAttemptProjectionEngine,
} from './execution-attempt-projection.ts';
import type { ExecutionAttemptInputs } from './execution-attempt-types.ts';

function appendStatusEvaluationEvent(input: {
  historyStore: ExecutionAttemptHistoryStore;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  attemptState: string;
  attemptLifecycleState: string;
}): void {
  input.historyStore.append({
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'execution_attempt_status_evaluated',
    reasoning: 'execution_attempt_status_evaluated',
    payload: {
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      attemptState: input.attemptState,
      attemptLifecycleState: input.attemptLifecycleState,
    },
  });
}

export function createExecutionAttemptInspection(options: {
  evaluator?: ExecutionAttemptEvaluator;
  projection?: ExecutionAttemptProjectionEngine;
  historyStore?: ExecutionAttemptHistoryStore;
  materializer?: ExecutionAttemptMaterializer;
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

  const projection = options.projection ?? createExecutionAttemptProjection({
    evaluator,
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
  });

  const materializer = options.materializer ?? createExecutionAttemptMaterializer({
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
  });

  function createExecutionAttempt(input: {
    runtimeEnvelopeId: string;
    attemptIndex?: number;
    attemptInputs?: ExecutionAttemptInputs;
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    const projected = projection.projectOne(input);

    historyStore.append({
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      eventType: 'execution_attempt_created',
      reasoning: 'execution_attempt_created',
      payload: {
        executionAttemptId: projected.executionAttemptId,
        runtimeEnvelopeId: projected.runtimeEnvelopeId,
        executionContractId: projected.executionContractId,
        missionId: projected.missionId,
        attemptIndex: projected.attemptIndex,
        executionAttemptPolicyId: input.executionAttemptPolicyId ?? null,
        attemptInputs: projected.attemptInputs,
      },
    });

    return projection.projectOne({ executionAttemptId: projected.executionAttemptId });
  }

  function evaluateExecutionAttempt(input: {
    executionAttemptId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    const projected = projection.projectOne(input);

    appendStatusEvaluationEvent({
      historyStore,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      attemptState: projected.attemptState,
      attemptLifecycleState: projected.attemptLifecycleState,
    });

    return projection.projectOne(input);
  }

  function listExecutionAttempts(input: {
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
  } = {}) {
    return projection.summarizeList(input);
  }

  function inspectExecutionAttempt(input: {
    executionAttemptId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    return projection.projectOne(input);
  }

  function executionAttemptStatus(input: {
    executionAttemptId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    return projection.projectOne(input).statusPreview;
  }

  function executionAttemptHistory(input: {
    executionAttemptId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });
  }

  function cancelExecutionAttempt(input: {
    executionAttemptId: string;
    reason?: string;
    cancelledBy?: string;
  }) {
    const projected = projection.projectOne({ executionAttemptId: input.executionAttemptId });

    historyStore.append({
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      eventType: 'execution_attempt_cancelled',
      reasoning: 'execution_attempt_cancelled',
      payload: {
        executionAttemptId: projected.executionAttemptId,
        runtimeEnvelopeId: projected.runtimeEnvelopeId,
        executionContractId: projected.executionContractId,
        missionId: projected.missionId,
        reason: input.reason ?? null,
        cancelledBy: input.cancelledBy ?? null,
      },
    });

    return projection.projectOne({ executionAttemptId: projected.executionAttemptId });
  }

  function materializeExecutionAttempt(input: {
    executionAttemptId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    evaluateExecutionAttempt(input);
    return materializer.materializeOne(input);
  }

  return {
    createExecutionAttempt,
    evaluateExecutionAttempt,
    listExecutionAttempts,
    inspectExecutionAttempt,
    executionAttemptStatus,
    executionAttemptHistory,
    cancelExecutionAttempt,
    materializeExecutionAttempt,
  };
}

export type ExecutionAttemptInspection = ReturnType<typeof createExecutionAttemptInspection>;
