import {
  createExecutionJournalInspection,
  type ExecutionJournalInspection,
} from '../execution-journal/execution-journal-inspection.ts';

import {
  createExecutionEngineEvaluator,
  type ExecutionEngineEvaluator,
} from './execution-engine-evaluator.ts';
import {
  createExecutionEngineHistoryStore,
  type ExecutionEngineHistoryStore,
} from './execution-engine-history-store.ts';
import {
  createExecutionEngineMaterializer,
  type ExecutionEngineMaterializer,
} from './execution-engine-materializer.ts';
import {
  createExecutionEngineProjection,
  type ExecutionEngineProjectionEngine,
} from './execution-engine-projection.ts';
import {
  createExecutionEngineRunner,
  type ExecutionEngineRunner,
} from './execution-engine-runner.ts';
import type { ExecutionEngineRunMode } from './execution-engine-types.ts';

function appendReadinessEvents(input: {
  historyStore: ExecutionEngineHistoryStore;
  run: {
    executionEngineRunId: string;
    executionAttemptId: string;
    executionJournalId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
    engineState: string;
    engineEligibilityState: string;
    runMode: string;
    blockingReasons: string[];
  };
}): void {
  input.historyStore.append({
    executionEngineRunId: input.run.executionEngineRunId,
    executionAttemptId: input.run.executionAttemptId,
    executionJournalId: input.run.executionJournalId,
    runtimeEnvelopeId: input.run.runtimeEnvelopeId,
    executionContractId: input.run.executionContractId,
    missionId: input.run.missionId,
    eventType: 'engine_run_initialized',
    reasoning: 'execution_engine_run_initialized',
    payload: {
      executionEngineRunId: input.run.executionEngineRunId,
      executionAttemptId: input.run.executionAttemptId,
      engineState: input.run.engineState,
      engineEligibilityState: input.run.engineEligibilityState,
      runMode: input.run.runMode,
    },
  });

  if (input.run.engineEligibilityState === 'eligible') {
    input.historyStore.append({
      executionEngineRunId: input.run.executionEngineRunId,
      executionAttemptId: input.run.executionAttemptId,
      executionJournalId: input.run.executionJournalId,
      runtimeEnvelopeId: input.run.runtimeEnvelopeId,
      executionContractId: input.run.executionContractId,
      missionId: input.run.missionId,
      eventType: 'engine_run_eligible',
      reasoning: 'execution_engine_run_eligible',
      payload: {
        executionEngineRunId: input.run.executionEngineRunId,
        executionAttemptId: input.run.executionAttemptId,
        engineEligibilityState: input.run.engineEligibilityState,
        blockingReasons: input.run.blockingReasons,
      },
    });
  }
}

export function createExecutionEngineInspection(options: {
  evaluator?: ExecutionEngineEvaluator;
  projection?: ExecutionEngineProjectionEngine;
  historyStore?: ExecutionEngineHistoryStore;
  runner?: ExecutionEngineRunner;
  materializer?: ExecutionEngineMaterializer;
  executionJournalInspection?: ExecutionJournalInspection;
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
} = {}) {
  const evaluator = options.evaluator ?? createExecutionEngineEvaluator({
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
  });

  const historyStore = options.historyStore ?? createExecutionEngineHistoryStore({
    artifactsRoot: options.executionEngineArtifactsRoot,
  });

  const projection = options.projection ?? createExecutionEngineProjection({
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
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
  });

  const runner = options.runner ?? createExecutionEngineRunner({
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
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
  });

  const materializer = options.materializer ?? createExecutionEngineMaterializer({
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
  });

  const executionJournalInspection = options.executionJournalInspection ?? createExecutionJournalInspection({
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
  });

  function evaluateEngineReadiness(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const run = evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
    appendReadinessEvents({ historyStore, run });
    return projection.projectOne(input);
  }

  function listEngineRuns(input: {
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  } = {}) {
    return projection.summarizeList(input);
  }

  function inspectEngineRun(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    return projection.projectOne(input);
  }

  function engineRunStatus(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    return projection.projectOne(input).statusPreview;
  }

  function engineRunHistory(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      executionJournalId: projected.executionJournalId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });
  }

  function inspectRunOutputs(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    return projection.projectOne(input).runOutputs;
  }

  function inspectLinkedJournal(input: { executionAttemptId: string }) {
    return executionJournalInspection.inspectExecutionJournal({ executionAttemptId: input.executionAttemptId });
  }

  function startEngineRun(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    evaluateEngineReadiness(input);
    return runner.startRun(input);
  }

  function completeEngineRun(input: {
    executionAttemptId: string;
    completionReason?: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    return runner.completeRun(input);
  }

  function failEngineRun(input: {
    executionAttemptId: string;
    failureReason: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    return runner.failRun(input);
  }

  function cancelEngineRun(input: {
    executionAttemptId: string;
    cancellationReason: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    return runner.cancelRun(input);
  }

  function materializeEngineRun(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
  }) {
    evaluateEngineReadiness({
      executionAttemptId: input.executionAttemptId,
      enginePolicyId: input.enginePolicyId,
    });
    return materializer.materializeOne(input);
  }

  return {
    evaluateEngineReadiness,
    listEngineRuns,
    inspectEngineRun,
    engineRunStatus,
    engineRunHistory,
    inspectRunOutputs,
    inspectLinkedJournal,
    startEngineRun,
    completeEngineRun,
    failEngineRun,
    cancelEngineRun,
    materializeEngineRun,
  };
}

export type ExecutionEngineInspection = ReturnType<typeof createExecutionEngineInspection>;
