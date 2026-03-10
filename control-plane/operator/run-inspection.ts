import type { ExecutionEvent } from '../journal/types.ts';
import type { WorkflowNodeRecord } from '../observability/node-record.ts';
import type { WorkflowRunRecord } from '../observability/run-record.ts';

export type CanonicalRunStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type FailureClass =
  | 'transient_runtime_error'
  | 'adapter_error'
  | 'artifact_validation_error'
  | 'workflow_definition_error'
  | 'mission_definition_error'
  | 'non_retryable_execution_error';

export type ArtifactExpectation = {
  path: string;
  type?: string;
  required: boolean;
};

export type ArtifactSummary = {
  path: string;
  type?: string;
  required: boolean;
  exists: boolean;
  valid: boolean;
};

export type RunAttemptSummary = {
  attemptIndex: number;
  status: CanonicalRunStatus;
  failureClass?: FailureClass;
  failureReason?: string;
};

export type NormalizedRunInspection = {
  runId: string;
  missionId: string | null;
  workflowId: string;
  teamId: string | null;
  status: CanonicalRunStatus;
  attemptCount: number;
  currentAttemptIndex: number;
  retryCount: number;
  failureClass?: FailureClass;
  failureReason?: string;
  artifacts: ArtifactSummary[];
  attempts: RunAttemptSummary[];
  artifactValidation: {
    status: 'complete' | 'partial' | 'failed';
    missingRequired: string[];
    missingOptional: string[];
  };
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function extensionForFormat(format: string): string {
  if (format === 'csv') {
    return 'csv';
  }
  if (format === 'xlsx') {
    return 'xlsx';
  }
  if (format === 'markdown') {
    return 'md';
  }
  return 'json';
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseArtifactExpectationsFromEvents(events: ExecutionEvent[]): ArtifactExpectation[] {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const payload = toRecord(ordered[index]?.payload);
    const contextSnapshot = toRecord(payload.context_snapshot);
    const memory = toRecord(contextSnapshot.memory);

    const candidates = [memory.declaredArtifacts, toRecord(memory.missionContext).declaredArtifacts];
    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }

      const dedupe = new Map<string, ArtifactExpectation>();
      for (const value of candidate) {
        const entry = toRecord(value);
        const artifactId = typeof entry.artifactId === 'string' ? entry.artifactId.trim() : '';
        const format = typeof entry.format === 'string' ? entry.format.trim() : '';
        const required = entry.required !== false;
        if (artifactId.length === 0 || format.length === 0) {
          continue;
        }

        const artifactPath = `${artifactId}.${extensionForFormat(format)}`;
        const existing = dedupe.get(artifactPath);
        dedupe.set(artifactPath, {
          path: artifactPath,
          type: format,
          required: existing ? (existing.required || required) : required
        });
      }

      return Array.from(dedupe.values()).sort((left, right) => left.path.localeCompare(right.path));
    }
  }

  return [];
}

export function summarizeArtifacts(input: {
  expected: ArtifactExpectation[];
  actualFiles: string[];
}): {
  artifacts: ArtifactSummary[];
  status: 'complete' | 'partial' | 'failed';
  missingRequired: string[];
  missingOptional: string[];
} {
  const actual = sortedUnique(input.actualFiles);
  const expected = [...input.expected]
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      required: entry.required
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const artifactRows: ArtifactSummary[] = expected.map((artifact) => {
    const exists = actual.includes(artifact.path);
    return {
      path: artifact.path,
      type: artifact.type,
      required: artifact.required,
      exists,
      valid: exists
    };
  });

  const expectedSet = new Set(expected.map((entry) => entry.path));
  const extras = actual
    .filter((file) => !expectedSet.has(file))
    .map((file) => ({
      path: file,
      required: false,
      exists: true,
      valid: true
    }));

  const artifacts = [...artifactRows, ...extras].sort((left, right) => left.path.localeCompare(right.path));
  const missingRequired = artifactRows
    .filter((entry) => entry.required && !entry.exists)
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));
  const missingOptional = artifactRows
    .filter((entry) => !entry.required && !entry.exists)
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));

  if (missingRequired.length > 0) {
    return {
      artifacts,
      status: 'failed',
      missingRequired,
      missingOptional
    };
  }

  return {
    artifacts,
    status: missingOptional.length > 0 ? 'partial' : 'complete',
    missingRequired,
    missingOptional
  };
}

function latestRetrySignal(events: ExecutionEvent[]): boolean {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const event = ordered[index];
    if (!event) {
      continue;
    }
    if (event.type === 'NODE_RETRY_SCHEDULED' || event.type === 'NODE_RETRY_STARTED') {
      return true;
    }
    if (event.type === 'TASK_STARTED' || event.type === 'TASK_COMPLETED' || event.type === 'TASK_FAILED') {
      return false;
    }
  }
  return false;
}

function deriveCanonicalStatus(input: {
  runStatus: string;
  events: ExecutionEvent[];
  nodeStates: WorkflowNodeRecord[];
  artifactValidationStatus: 'complete' | 'partial' | 'failed';
}): CanonicalRunStatus {
  if (input.runStatus === 'cancelled') {
    return 'cancelled';
  }

  if (input.artifactValidationStatus === 'failed') {
    return 'failed';
  }

  if (input.runStatus === 'completed') {
    return 'succeeded';
  }

  if (input.runStatus === 'failed' || input.runStatus === 'timeout') {
    return 'failed';
  }

  if (input.runStatus === 'running') {
    if (input.nodeStates.some((node) => node.status === 'retrying') || latestRetrySignal(input.events)) {
      return 'retrying';
    }
    return 'running';
  }

  if (input.events.length === 0) {
    return 'queued';
  }

  if (input.events.some((event) => event.type === 'TASK_STARTED')) {
    return 'running';
  }

  return 'starting';
}

function mapFailureCodeToClass(code: string): FailureClass {
  if (
    code === 'NODE_TIMEOUT'
    || code === 'ADAPTER_TIMEOUT'
    || code === 'WORKFLOW_TIMEOUT'
    || code === 'TOOL_TIMEOUT'
  ) {
    return 'transient_runtime_error';
  }

  if (code === 'WORKFLOW_VALIDATION_FAILED') {
    return 'workflow_definition_error';
  }

  if (
    code === 'ADAPTER_EXECUTION_FAILED'
    || code === 'TASK_RESULT_INVALID'
    || code === 'DEPENDENCY_UNSATISFIED'
    || code === 'AGENT_RESOLUTION_FAILED'
    || code === 'TOOL_PERMISSION_DENIED'
    || code === 'CONTEXT_MERGE_FAILED'
  ) {
    return 'adapter_error';
  }

  return 'non_retryable_execution_error';
}

function extractEventFailureReason(events: ExecutionEvent[]): string | null {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const event = ordered[index];
    if (!event || event.type !== 'RUN_FAILED') {
      continue;
    }

    const payload = toRecord(event.payload);
    const reason = typeof payload.error === 'string' ? payload.error.trim() : '';
    if (reason.length > 0) {
      return reason;
    }
  }

  return null;
}

function classifyFailure(input: {
  canonicalStatus: CanonicalRunStatus;
  artifactValidation: {
    missingRequired: string[];
  };
  nodeStates: WorkflowNodeRecord[];
  events: ExecutionEvent[];
}): { failureClass?: FailureClass; failureReason?: string } {
  if (input.artifactValidation.missingRequired.length > 0) {
    const missing = input.artifactValidation.missingRequired.join(', ');
    return {
      failureClass: 'artifact_validation_error',
      failureReason: `required artifact missing: ${missing}`
    };
  }

  if (input.canonicalStatus !== 'failed') {
    return {};
  }

  const failedNode = [...input.nodeStates]
    .filter((node) => node.status === 'failed' || node.status === 'timeout')
    .sort((left, right) => {
      const leftSequence = left.sequenceCompleted ?? left.sequenceStarted;
      const rightSequence = right.sequenceCompleted ?? right.sequenceStarted;
      const sequenceCmp = leftSequence - rightSequence;
      if (sequenceCmp !== 0) {
        return sequenceCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    })
    .at(0);

  if (failedNode?.failure?.code) {
    return {
      failureClass: mapFailureCodeToClass(failedNode.failure.code),
      failureReason: failedNode.failure.message
    };
  }

  const eventReason = extractEventFailureReason(input.events);
  if (eventReason) {
    const normalized = eventReason.toLowerCase();
    if (normalized.includes('mission') && (normalized.includes('invalid') || normalized.includes('not found'))) {
      return {
        failureClass: 'mission_definition_error',
        failureReason: eventReason
      };
    }

    if (normalized.includes('workflow') && (normalized.includes('invalid') || normalized.includes('schema') || normalized.includes('dag'))) {
      return {
        failureClass: 'workflow_definition_error',
        failureReason: eventReason
      };
    }

    return {
      failureClass: 'non_retryable_execution_error',
      failureReason: eventReason
    };
  }

  return {
    failureClass: 'non_retryable_execution_error',
    failureReason: 'workflow_execution_failed'
  };
}

function deriveRetryCount(nodeStates: WorkflowNodeRecord[]): number {
  return nodeStates.reduce((max, node) => {
    const value = typeof node.retryCount === 'number' ? node.retryCount : 0;
    return value > max ? value : max;
  }, 0);
}

function buildAttempts(input: {
  finalStatus: CanonicalRunStatus;
  retryCount: number;
  failureClass?: FailureClass;
  failureReason?: string;
}): RunAttemptSummary[] {
  const attempts: RunAttemptSummary[] = [];
  const total = input.retryCount + 1;

  for (let index = 0; index < total; index += 1) {
    if (index === total - 1) {
      attempts.push({
        attemptIndex: index,
        status: input.finalStatus,
        ...(input.finalStatus === 'failed' && input.failureClass ? { failureClass: input.failureClass } : {}),
        ...(input.finalStatus === 'failed' && input.failureReason ? { failureReason: input.failureReason } : {})
      });
      continue;
    }

    if (index === 0) {
      attempts.push({
        attemptIndex: index,
        status: 'failed',
        ...(input.failureClass ? { failureClass: input.failureClass } : {}),
        ...(input.failureReason ? { failureReason: input.failureReason } : {})
      });
      continue;
    }

    attempts.push({
      attemptIndex: index,
      status: 'retrying'
    });
  }

  return attempts;
}

export function buildNormalizedRunInspection(input: {
  run: WorkflowRunRecord;
  events: ExecutionEvent[];
  nodeStates: WorkflowNodeRecord[];
  actualArtifactFiles: string[];
  expectedArtifacts?: ArtifactExpectation[];
}): NormalizedRunInspection {
  const expectedArtifacts = [...(input.expectedArtifacts ?? [])]
    .sort((left, right) => left.path.localeCompare(right.path));
  const artifactValidation = summarizeArtifacts({
    expected: expectedArtifacts,
    actualFiles: input.actualArtifactFiles
  });
  const canonicalStatus = deriveCanonicalStatus({
    runStatus: input.run.status,
    events: input.events,
    nodeStates: input.nodeStates,
    artifactValidationStatus: artifactValidation.status
  });

  const failure = classifyFailure({
    canonicalStatus,
    artifactValidation,
    nodeStates: input.nodeStates,
    events: input.events
  });

  const retryCount = deriveRetryCount(input.nodeStates);
  const attempts = buildAttempts({
    finalStatus: canonicalStatus,
    retryCount,
    failureClass: failure.failureClass,
    failureReason: failure.failureReason
  });

  return {
    runId: input.run.runId,
    missionId: input.run.missionId,
    workflowId: input.run.workflowId,
    teamId: input.run.teamId,
    status: canonicalStatus,
    attemptCount: attempts.length,
    currentAttemptIndex: attempts.length - 1,
    retryCount,
    ...(failure.failureClass ? { failureClass: failure.failureClass } : {}),
    ...(failure.failureReason ? { failureReason: failure.failureReason } : {}),
    artifacts: artifactValidation.artifacts,
    attempts,
    artifactValidation: {
      status: artifactValidation.status,
      missingRequired: artifactValidation.missingRequired,
      missingOptional: artifactValidation.missingOptional
    }
  };
}

export function isFailureClassRetryable(failureClass: FailureClass): boolean {
  return failureClass === 'transient_runtime_error' || failureClass === 'adapter_error';
}
