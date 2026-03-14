import type {
  BuildExecutionHistoryEvent,
  BuildExecutionStatus,
  ValidationResult,
} from './build-execution-types.ts';

export function deriveBuildExecutionStatus(input: {
  validation: ValidationResult;
  history: BuildExecutionHistoryEvent[];
}): BuildExecutionStatus {
  const eventTypes = new Set(input.history.map((entry) => entry.eventType));

  if (eventTypes.has('build_execution_failed')) {
    return 'failed';
  }

  if (eventTypes.has('build_execution_completed')) {
    return 'completed';
  }

  if (eventTypes.has('build_execution_started')) {
    return 'running';
  }

  if (input.validation.validationState === 'valid' || input.validation.validationState === 'warning') {
    return 'ready';
  }

  return 'draft';
}

export function assertBuildExecutionCanStart(status: BuildExecutionStatus): void {
  if (status !== 'ready') {
    throw new Error(`BUILD_EXECUTION_RUN_NOT_READY: ${status}`);
  }
}
