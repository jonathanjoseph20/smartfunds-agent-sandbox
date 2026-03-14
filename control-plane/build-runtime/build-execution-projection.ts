import { deriveBuildExecutionStatus } from './build-execution-status.ts';
import type {
  BuildExecutionHistoryEvent,
  BuildExecutionProjection,
  BuildExecutionRun,
  ValidationResult,
} from './build-execution-types.ts';

function latestValidation(validationResults: ValidationResult[]): ValidationResult {
  if (validationResults.length === 0) {
    return {
      validationState: 'warning',
      missingFields: ['validationResults'],
      violations: [],
      warnings: ['validation_results_missing'],
    };
  }

  return validationResults[validationResults.length - 1]!;
}

export function projectBuildExecutionRun(input: {
  run: BuildExecutionRun;
  history: BuildExecutionHistoryEvent[];
  validation: ValidationResult;
}): BuildExecutionProjection {
  const derivedStatus = deriveBuildExecutionStatus({
    validation: input.validation,
    history: input.history,
  });

  const historySorted = [...input.history].sort((left, right) => {
    const byRun = left.runId.localeCompare(right.runId);
    if (byRun !== 0) {
      return byRun;
    }
    const byType = left.eventType.localeCompare(right.eventType);
    if (byType !== 0) {
      return byType;
    }
    return left.payloadHash.localeCompare(right.payloadHash);
  });

  return {
    runId: input.run.runId,
    packetId: input.run.packetId,
    bundleId: input.run.bundleId,
    graphId: input.run.graphId,
    taskId: input.run.taskId,
    repoTarget: input.run.repoTarget,
    status: derivedStatus,
    executionSteps: input.run.executionPlan.steps.length,
    artifactCount: input.run.generatedArtifacts.length,
    validationState: input.validation.validationState,
    validationMissingFields: [...input.validation.missingFields],
    validationViolations: [...input.validation.violations],
    validationWarnings: [...input.validation.warnings],
    generatedArtifacts: [...input.run.generatedArtifacts].sort((left, right) => left.artifactId.localeCompare(right.artifactId)),
    historySummary: {
      totalEvents: historySorted.length,
      ...(historySorted.length > 0 ? { lastEventType: historySorted[historySorted.length - 1]!.eventType } : {}),
    },
  };
}

export function listBuildExecutionProjections(input: {
  runs: BuildExecutionRun[];
  getHistory: (runId: string) => BuildExecutionHistoryEvent[];
}): BuildExecutionProjection[] {
  return [...input.runs]
    .sort((left, right) => left.runId.localeCompare(right.runId))
    .map((run) => {
      const validation = latestValidation(run.validationResults);
      const history = input.getHistory(run.runId);

      return projectBuildExecutionRun({
        run,
        history,
        validation,
      });
    })
    .sort((left, right) => left.runId.localeCompare(right.runId));
}

export { latestValidation };
