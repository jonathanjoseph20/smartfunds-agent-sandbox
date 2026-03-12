import {
  createRuntimeEnvelopeEvaluator,
  type RuntimeEnvelopeEvaluator,
} from './runtime-envelope-evaluator.ts';
import {
  createRuntimeEnvelopeHistoryStore,
  type RuntimeEnvelopeHistoryStore,
} from './runtime-envelope-history-store.ts';
import {
  createRuntimeEnvelopeMaterializer,
  type RuntimeEnvelopeMaterializer,
} from './runtime-envelope-materializer.ts';
import {
  createRuntimeEnvelopeProjection,
  type RuntimeEnvelopeProjectionEngine,
} from './runtime-envelope-projection.ts';

function appendEvaluationEvents(input: {
  historyStore: RuntimeEnvelopeHistoryStore;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  envelopeState: string;
  envelopeEligibility: string;
}): void {
  input.historyStore.append({
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'runtime_envelope_evaluated',
    reasoning: 'runtime_envelope_evaluated',
    payload: {
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      envelopeState: input.envelopeState,
      envelopeEligibility: input.envelopeEligibility,
    },
  });

  if (input.envelopeState === 'ready_for_runtime') {
    input.historyStore.append({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: 'runtime_envelope_ready',
      reasoning: 'runtime_envelope_ready_for_runtime',
      payload: {
        runtimeEnvelopeId: input.runtimeEnvelopeId,
        executionContractId: input.executionContractId,
        missionId: input.missionId,
      },
    });
  }

  if (input.envelopeState === 'blocked') {
    input.historyStore.append({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: 'runtime_envelope_blocked',
      reasoning: 'runtime_envelope_blocked_by_preconditions',
      payload: {
        runtimeEnvelopeId: input.runtimeEnvelopeId,
        executionContractId: input.executionContractId,
        missionId: input.missionId,
      },
    });
  }
}

export function createRuntimeEnvelopeInspection(options: {
  evaluator?: RuntimeEnvelopeEvaluator;
  projection?: RuntimeEnvelopeProjectionEngine;
  historyStore?: RuntimeEnvelopeHistoryStore;
  materializer?: RuntimeEnvelopeMaterializer;
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

  const projection = options.projection ?? createRuntimeEnvelopeProjection({
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
  });

  const materializer = options.materializer ?? createRuntimeEnvelopeMaterializer({
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
  });

  function evaluateRuntimeEnvelope(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    const evaluated = projection.projectOne(input);

    appendEvaluationEvents({
      historyStore,
      runtimeEnvelopeId: evaluated.runtimeEnvelopeId,
      executionContractId: evaluated.executionContractId,
      missionId: evaluated.missionId,
      envelopeState: evaluated.envelopeState,
      envelopeEligibility: evaluated.envelopeEligibility,
    });

    return projection.projectOne(input);
  }

  function listRuntimeEnvelopes(input: { runtimeEnvelopePolicyId?: string } = {}) {
    return projection.summarizeList(input);
  }

  function inspectRuntimeEnvelope(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    return projection.projectOne(input);
  }

  function runtimeEnvelopeStatus(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    return projection.projectOne(input).statusPreview;
  }

  function runtimeEnvelopeHistory(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });
  }

  function confirmRuntimeEnvelope(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
    reviewedBy?: string;
  }) {
    const projected = evaluateRuntimeEnvelope({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });

    historyStore.append({
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      eventType: 'runtime_envelope_confirmed',
      reasoning: 'runtime_envelope_confirmed_by_founder',
      payload: {
        runtimeEnvelopeId: projected.runtimeEnvelopeId,
        executionContractId: projected.executionContractId,
        missionId: projected.missionId,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    return projection.projectOne({
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });
  }

  function rejectRuntimeEnvelope(input: {
    runtimeEnvelopeId: string;
    reason: string;
    runtimeEnvelopePolicyId?: string;
    reviewedBy?: string;
  }) {
    const projected = evaluateRuntimeEnvelope({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });

    historyStore.append({
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      eventType: 'runtime_envelope_rejected',
      reasoning: 'runtime_envelope_rejected_by_founder',
      payload: {
        runtimeEnvelopeId: projected.runtimeEnvelopeId,
        executionContractId: projected.executionContractId,
        missionId: projected.missionId,
        reason: input.reason,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    return projection.projectOne({
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });
  }

  function materializeRuntimeEnvelope(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }) {
    evaluateRuntimeEnvelope(input);
    return materializer.materializeOne(input);
  }

  return {
    listRuntimeEnvelopes,
    inspectRuntimeEnvelope,
    runtimeEnvelopeStatus,
    runtimeEnvelopeHistory,
    evaluateRuntimeEnvelope,
    confirmRuntimeEnvelope,
    rejectRuntimeEnvelope,
    materializeRuntimeEnvelope,
  };
}

export type RuntimeEnvelopeInspection = ReturnType<typeof createRuntimeEnvelopeInspection>;
