import {
  createExecutionContractEvaluator,
  type ExecutionContractEvaluator,
} from './execution-contract-evaluator.ts';
import {
  createExecutionContractHistoryStore,
  type ExecutionContractHistoryStore,
} from './execution-contract-history-store.ts';
import {
  createExecutionContractMaterializer,
  type ExecutionContractMaterializer,
} from './execution-contract-materializer.ts';
import {
  createExecutionContractProjection,
  type ExecutionContractProjectionEngine,
} from './execution-contract-projection.ts';

function appendEvaluationEvents(input: {
  historyStore: ExecutionContractHistoryStore;
  executionContractId: string;
  missionId: string;
  contractState: string;
  executionEligibilityState: string;
  executionPolicyId: string;
}): void {
  input.historyStore.append({
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'execution_contract_evaluated',
    reasoning: 'execution_contract_evaluated',
    payload: {
      missionId: input.missionId,
      executionContractId: input.executionContractId,
      executionPolicyId: input.executionPolicyId,
      contractState: input.contractState,
      executionEligibilityState: input.executionEligibilityState,
    },
  });

  if (input.contractState === 'ready_for_runtime_handoff') {
    input.historyStore.append({
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: 'execution_contract_ready',
      reasoning: 'execution_contract_ready_for_runtime_handoff',
      payload: {
        missionId: input.missionId,
        executionContractId: input.executionContractId,
      },
    });
  }

  if (input.contractState === 'blocked') {
    input.historyStore.append({
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: 'execution_contract_blocked',
      reasoning: 'execution_contract_blocked_by_preconditions',
      payload: {
        missionId: input.missionId,
        executionContractId: input.executionContractId,
      },
    });
  }
}

export function createExecutionContractInspection(options: {
  evaluator?: ExecutionContractEvaluator;
  projection?: ExecutionContractProjectionEngine;
  historyStore?: ExecutionContractHistoryStore;
  materializer?: ExecutionContractMaterializer;
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

  const projection = options.projection ?? createExecutionContractProjection({
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
  });

  const materializer = options.materializer ?? createExecutionContractMaterializer({
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
  });

  function evaluateExecutionContract(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    const evaluated = projection.projectOne(input);

    appendEvaluationEvents({
      historyStore,
      executionContractId: evaluated.executionContractId,
      missionId: evaluated.missionId,
      contractState: evaluated.contractState,
      executionEligibilityState: evaluated.executionEligibilityState,
      executionPolicyId: evaluated.executionPolicyId,
    });

    return projection.projectOne(input);
  }

  function inspectExecutionContract(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    return projection.projectOne(input);
  }

  function listExecutionContracts(input: { executionPolicyId?: string } = {}) {
    return projection.summarizeList(input);
  }

  function getExecutionContractStatus(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    return projection.projectOne(input).statusPreview;
  }

  function getExecutionContractHistory(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });
  }

  function getExecutionTarget(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return {
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      executionTarget: projected.executionTarget,
    };
  }

  function getRuntimeEnvelopeStub(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return projected.runtimeEnvelopeStub;
  }

  function confirmExecutionContract(input: {
    missionId: string;
    executionPolicyId?: string;
    reviewedBy?: string;
  }) {
    const projected = evaluateExecutionContract({
      missionId: input.missionId,
      executionPolicyId: input.executionPolicyId,
    });

    historyStore.append({
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      eventType: 'execution_contract_confirmed',
      reasoning: 'execution_contract_confirmed_by_founder',
      payload: {
        missionId: projected.missionId,
        executionContractId: projected.executionContractId,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    return projection.projectOne({
      missionId: input.missionId,
      executionPolicyId: projected.executionPolicyId,
    });
  }

  function rejectExecutionContract(input: {
    missionId: string;
    reason: string;
    reviewedBy?: string;
    executionPolicyId?: string;
  }) {
    const projected = evaluateExecutionContract({
      missionId: input.missionId,
      executionPolicyId: input.executionPolicyId,
    });

    historyStore.append({
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      eventType: 'execution_contract_rejected',
      reasoning: 'execution_contract_rejected_by_founder',
      payload: {
        missionId: projected.missionId,
        executionContractId: projected.executionContractId,
        reason: input.reason,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    return projection.projectOne({
      missionId: input.missionId,
      executionPolicyId: projected.executionPolicyId,
    });
  }

  function materializeExecutionContract(input: {
    missionId: string;
    executionPolicyId?: string;
  }) {
    evaluateExecutionContract(input);
    return materializer.materializeOne(input);
  }

  return {
    evaluateExecutionContract,
    inspectExecutionContract,
    listExecutionContracts,
    getExecutionContractStatus,
    getExecutionContractHistory,
    getExecutionTarget,
    getRuntimeEnvelopeStub,
    confirmExecutionContract,
    rejectExecutionContract,
    materializeExecutionContract,
  };
}

export type ExecutionContractInspection = ReturnType<typeof createExecutionContractInspection>;
