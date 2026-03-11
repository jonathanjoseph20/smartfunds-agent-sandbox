import type { InvestigationFailureDisposition, InvestigationWaitCondition } from './investigation-lifecycle.ts';
import type { InvestigationCompletionCriteria } from './completion-types.ts';

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
  'awaiting_data',
  'scheduled_resume',
  'retry_pending',
  'blocked',
  'completed',
  'failed',
  'cancelled'
] as const;

export const INVESTIGATION_PHASE_EXECUTION_MODES = ['immediate', 'next_tick', 'delayed'] as const;
export const INVESTIGATION_RETRY_POLICIES = ['never', 'bounded'] as const;

export type InvestigationPhaseKind = typeof INVESTIGATION_PHASE_KINDS[number];
export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];
export type InvestigationPhaseExecutionMode = typeof INVESTIGATION_PHASE_EXECUTION_MODES[number];
export type InvestigationRetryPolicy = typeof INVESTIGATION_RETRY_POLICIES[number];

export type InvestigationPhaseDefinition = {
  phaseId: string;
  kind: InvestigationPhaseKind;
  missionId?: string;
  workflowId?: string;
  requiredInputs: string[];
  produces: string[];
  executionMode?: InvestigationPhaseExecutionMode;
  minDelaySlots?: number;
  waitCondition?: InvestigationWaitCondition;
  maxRetries?: number;
  retryPolicy?: InvestigationRetryPolicy;
};

export type InvestigationDefinition = {
  investigationDefinitionId: string;
  sourceSignalType?: string;
  sourceTriggerId?: string;
  phases: InvestigationPhaseDefinition[];
  outputArtifacts: string[];
  completionCriteria: string[];
  completionCriteriaConfig?: InvestigationCompletionCriteria;
  dedupeStrategy: 'definition_signal_slot';
};

export type InvestigationLaunchRequest = {
  missionId: string;
  triggerId: string;
  sourceSignal: string;
};

export type InvestigationLastPhaseResult = {
  phaseId: string;
  outcome: 'completed' | 'scheduled_resume' | 'awaiting_data' | 'retry_scheduled' | 'failed';
  reason: string;
  findings: string[];
};

export type InvestigationLastTransition = {
  fromStatus: InvestigationStatus;
  toStatus: InvestigationStatus;
  reason: string;
  schedulerSlot?: string;
  phaseId?: string;
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
  nextPhaseId?: string;
  nextEligibleSlot?: string;
  waitingReason?: string;
  waitCondition?: InvestigationWaitCondition;
  retryCountByPhase: Record<string, number>;
  lastAttemptedTransition?: string;
  lastPhaseResult?: InvestigationLastPhaseResult;
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
    eventType: 'LIFECYCLE_TRANSITION_RECORDED';
    investigationRunId: string;
    phaseId?: string;
    fromStatus: InvestigationStatus;
    toStatus: InvestigationStatus;
    reason: string;
    schedulerSlot?: string;
    nextEligibleSlot?: string;
    waitingReason?: string;
    waitCondition?: InvestigationWaitCondition;
    retryIndex?: number;
  }
  | {
    eventType: 'PHASE_SLOT_ADVANCEMENT_RECORDED';
    investigationRunId: string;
    phaseId: string;
    schedulerSlot: string;
  }
  | {
    eventType: 'PHASE_STARTED';
    investigationRunId: string;
    phaseId: string;
    phaseKind: InvestigationPhaseKind;
    schedulerSlot?: string;
  }
  | {
    eventType: 'PHASE_COMPLETED';
    investigationRunId: string;
    phaseId: string;
    phaseKind: InvestigationPhaseKind;
    findings: string[];
  }
  | {
    eventType: 'PHASE_RETRY_SCHEDULED';
    investigationRunId: string;
    phaseId: string;
    reason: string;
    retryIndex: number;
    nextEligibleSlot: string;
    schedulerSlot: string;
  }
  | {
    eventType: 'PHASE_WAITING_FOR_DATA';
    investigationRunId: string;
    phaseId: string;
    reason: string;
    waitCondition: InvestigationWaitCondition;
    nextEligibleSlot?: string;
    schedulerSlot: string;
  }
  | {
    eventType: 'PHASE_SCHEDULED_RESUME';
    investigationRunId: string;
    phaseId: string;
    reason: string;
    nextEligibleSlot: string;
    schedulerSlot: string;
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
  }
  | {
    eventType: 'INVESTIGATION_FINALIZATION_SIGNAL_EMITTED';
    investigationRunId: string;
    signalType:
      | 'investigation_ready_to_finalize'
      | 'investigation_completed'
      | 'investigation_inconclusive'
      | 'investigation_stalled'
      | 'investigation_confidence_degraded';
    signalFingerprint: string;
    toReadinessState:
      | 'ready_to_finalize'
      | 'still_evolving'
      | 'blocked'
      | 'inconclusive'
      | 'complete'
      | 'unhealthy';
    toHealthState:
      | 'healthy'
      | 'waiting_normally'
      | 'retrying'
      | 'blocked_by_missing_evidence'
      | 'degraded_by_counter_evidence'
      | 'stalled'
      | 'inconclusive';
    fromReadinessState?:
      | 'ready_to_finalize'
      | 'still_evolving'
      | 'blocked'
      | 'inconclusive'
      | 'complete'
      | 'unhealthy';
    fromHealthState?:
      | 'healthy'
      | 'waiting_normally'
      | 'retrying'
      | 'blocked_by_missing_evidence'
      | 'degraded_by_counter_evidence'
      | 'stalled'
      | 'inconclusive';
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

export type InvestigationDueItem = {
  investigationRunId: string;
  investigationDefinitionId: string;
  status: InvestigationStatus;
  currentPhaseId?: string;
  nextPhaseId?: string;
  nextEligibleSlot?: string;
  dueNow: boolean;
  dueReason: string;
  waitingReason?: string;
  retryCountByPhase: Record<string, number>;
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

export class InvestigationPhaseError extends Error {
  readonly disposition: InvestigationFailureDisposition;

  constructor(disposition: InvestigationFailureDisposition, message: string) {
    super(message);
    this.name = 'InvestigationPhaseError';
    this.disposition = disposition;
  }
}

export class InvestigationAwaitingDataError extends InvestigationPhaseError {
  constructor(message: string) {
    super('awaiting_data', message);
    this.name = 'InvestigationAwaitingDataError';
  }
}

export class InvestigationNonRetryableError extends InvestigationPhaseError {
  constructor(message: string) {
    super('non_retryable', message);
    this.name = 'InvestigationNonRetryableError';
  }
}
