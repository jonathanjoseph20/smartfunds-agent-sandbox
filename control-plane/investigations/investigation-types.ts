export const INVESTIGATION_PHASE_KINDS = [
  'intake',
  'gather',
  'analyze',
  'synthesize',
  'finalize'
] as const;

export const INVESTIGATION_STATUSES = [
  'pending',
  'running',
  'blocked',
  'completed',
  'failed',
  'cancelled'
] as const;

export type InvestigationPhaseKind = typeof INVESTIGATION_PHASE_KINDS[number];
export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];

export type InvestigationPhaseDefinition = {
  phaseId: string;
  kind: InvestigationPhaseKind;
  missionId?: string;
  workflowId?: string;
  requiredInputs: string[];
  produces: string[];
};

export type InvestigationDefinition = {
  investigationDefinitionId: string;
  sourceSignalType?: string;
  sourceTriggerId?: string;
  phases: InvestigationPhaseDefinition[];
  outputArtifacts: string[];
  completionCriteria: string[];
  dedupeStrategy: 'definition_signal_slot';
};

export type InvestigationLaunchRequest = {
  missionId: string;
  triggerId: string;
  sourceSignal: string;
};

export type InvestigationRecord = {
  investigationRunId: string;
  dedupeKey: string;
  investigationDefinitionId: string;
  sourceSignalReference: string;
  sourceSignalType: string;
  sourceTriggerId?: string;
  sourceTriggerReference?: string;
  slot: string;
  logDate: string;
  status: InvestigationStatus;
  currentPhaseId?: string;
  completedPhaseIds: string[];
  artifactPaths: string[];
  finalReportPath?: string;
  associatedMissionReferences: string[];
  findings: string[];
  failureReason?: string;
};

export type InvestigationEvent =
  | {
    eventType: 'INVESTIGATION_CREATED';
    investigationRunId: string;
    dedupeKey: string;
    investigationDefinitionId: string;
    sourceSignalReference: string;
    sourceSignalType: string;
    sourceTriggerId?: string;
    sourceTriggerReference?: string;
    slot: string;
    logDate: string;
    associatedMissionReferences: string[];
  }
  | {
    eventType: 'PHASE_STARTED';
    investigationRunId: string;
    phaseId: string;
    phaseKind: InvestigationPhaseKind;
  }
  | {
    eventType: 'PHASE_COMPLETED';
    investigationRunId: string;
    phaseId: string;
    phaseKind: InvestigationPhaseKind;
    findings: string[];
  }
  | {
    eventType: 'ARTIFACT_RECORDED';
    investigationRunId: string;
    artifactPath: string;
    artifactKind: string;
  }
  | {
    eventType: 'INVESTIGATION_COMPLETED';
    investigationRunId: string;
    finalReportPath: string;
    findings: string[];
  }
  | {
    eventType: 'INVESTIGATION_FAILED';
    investigationRunId: string;
    phaseId: string;
    reason: string;
  };

export type InvestigationEventRecord = InvestigationEvent & {
  sequence: number;
  logDate: string;
};

export type InvestigationExecutionResult =
  | {
    status: 'started';
    record: InvestigationRecord;
  }
  | {
    status: 'duplicate';
    record: InvestigationRecord;
  }
  | {
    status: 'failed';
    record: InvestigationRecord;
  };

export class InvestigationError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InvestigationError';
    this.code = code;
    this.details = details;
  }
}
