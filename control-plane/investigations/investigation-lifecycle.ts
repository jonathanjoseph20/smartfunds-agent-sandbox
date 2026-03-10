import { INVESTIGATION_STATUSES, type InvestigationPhaseDefinition, type InvestigationRecord, type InvestigationStatus } from './investigation-types.ts';

const TERMINAL_STATUSES: ReadonlySet<InvestigationStatus> = new Set(['completed', 'failed', 'cancelled']);

const LEGAL_TRANSITIONS: Readonly<Record<InvestigationStatus, readonly InvestigationStatus[]>> = {
  pending: ['running', 'scheduled_resume', 'awaiting_data', 'blocked', 'cancelled', 'failed'],
  running: ['running', 'awaiting_data', 'scheduled_resume', 'retry_pending', 'blocked', 'completed', 'failed', 'cancelled'],
  awaiting_data: ['scheduled_resume', 'running', 'blocked', 'failed', 'cancelled'],
  scheduled_resume: ['running', 'retry_pending', 'awaiting_data', 'blocked', 'failed', 'cancelled'],
  retry_pending: ['running', 'failed', 'cancelled'],
  blocked: ['scheduled_resume', 'running', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: []
};

export const WAIT_CONDITIONS = ['fixed_slot_delay', 'new_dataset_observation'] as const;
export type InvestigationWaitCondition = (typeof WAIT_CONDITIONS)[number];

export type InvestigationDueDecision =
  | 'due'
  | 'not_due'
  | 'awaiting_data'
  | 'duplicate_slot'
  | 'terminal'
  | 'missing_phase';

export type InvestigationFailureDisposition = 'retryable' | 'non_retryable' | 'awaiting_data';

export function isInvestigationStatus(value: string): value is InvestigationStatus {
  return (INVESTIGATION_STATUSES as readonly string[]).includes(value);
}

export function isTerminalInvestigationStatus(status: InvestigationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isLegalTransition(from: InvestigationStatus, to: InvestigationStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function assertLegalTransition(from: InvestigationStatus, to: InvestigationStatus): void {
  if (from === to && to === 'running') {
    return;
  }
  if (!isLegalTransition(from, to)) {
    throw new Error(`INVESTIGATION_INVALID_TRANSITION: ${from}->${to}`);
  }
}

type ParsedSlot =
  | { kind: 'daily'; date: string }
  | { kind: 'interval_hours'; every: number; instant: string }
  | { kind: 'interval_minutes'; every: number; instant: string }
  | { kind: 'unknown'; raw: string };

function parseSlot(slotId: string): ParsedSlot {
  const dailyMatch = /^daily:(\d{4}-\d{2}-\d{2})$/.exec(slotId);
  if (dailyMatch) {
    return { kind: 'daily', date: dailyMatch[1] };
  }

  const intervalHoursMatch = /^interval_hours:(\d+):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)$/.exec(slotId);
  if (intervalHoursMatch) {
    return {
      kind: 'interval_hours',
      every: Number.parseInt(intervalHoursMatch[1], 10),
      instant: intervalHoursMatch[2]
    };
  }

  const intervalMinutesMatch = /^interval_minutes:(\d+):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)$/.exec(slotId);
  if (intervalMinutesMatch) {
    return {
      kind: 'interval_minutes',
      every: Number.parseInt(intervalMinutesMatch[1], 10),
      instant: intervalMinutesMatch[2]
    };
  }

  return { kind: 'unknown', raw: slotId };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatUtcMinute(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}T${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}Z`;
}

function formatUtcDate(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

export function deriveLogDateFromSlot(slotId: string, fallbackDate: string): string {
  const parsed = parseSlot(slotId);
  if (parsed.kind === 'daily') {
    return parsed.date;
  }
  if (parsed.kind === 'interval_hours' || parsed.kind === 'interval_minutes') {
    return parsed.instant.slice(0, 10);
  }
  return fallbackDate;
}

export function computeNextEligibleSlot(input: { currentSlotId: string; delaySlots: number }): string {
  if (!Number.isInteger(input.delaySlots) || input.delaySlots < 0) {
    throw new Error(`INVESTIGATION_INVALID_DELAY_SLOTS: ${String(input.delaySlots)}`);
  }
  if (input.delaySlots === 0) {
    return input.currentSlotId;
  }

  const parsed = parseSlot(input.currentSlotId);
  if (parsed.kind === 'daily') {
    const date = new Date(`${parsed.date}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + input.delaySlots);
    return `daily:${formatUtcDate(date)}`;
  }

  if (parsed.kind === 'interval_hours') {
    const base = new Date(parsed.instant);
    const deltaMs = parsed.every * input.delaySlots * 60 * 60 * 1000;
    return `interval_hours:${parsed.every}:${formatUtcMinute(new Date(base.getTime() + deltaMs))}`;
  }

  if (parsed.kind === 'interval_minutes') {
    const base = new Date(parsed.instant);
    const deltaMs = parsed.every * input.delaySlots * 60 * 1000;
    return `interval_minutes:${parsed.every}:${formatUtcMinute(new Date(base.getTime() + deltaMs))}`;
  }

  return input.currentSlotId;
}

function slotTime(slotId: string): number | null {
  const parsed = parseSlot(slotId);
  if (parsed.kind === 'daily') {
    return Date.parse(`${parsed.date}T00:00:00.000Z`);
  }
  if (parsed.kind === 'interval_hours' || parsed.kind === 'interval_minutes') {
    return Date.parse(parsed.instant);
  }
  return null;
}

export function slotGte(leftSlotId: string, rightSlotId: string): boolean {
  if (leftSlotId === rightSlotId) {
    return true;
  }
  const left = slotTime(leftSlotId);
  const right = slotTime(rightSlotId);
  if (left !== null && right !== null) {
    return left >= right;
  }
  return leftSlotId.localeCompare(rightSlotId) >= 0;
}

export function resolveNextPhase(record: InvestigationRecord, phases: InvestigationPhaseDefinition[]): InvestigationPhaseDefinition | null {
  const completed = new Set(record.completedPhaseIds);
  for (const phase of phases) {
    if (!completed.has(phase.phaseId)) {
      return phase;
    }
  }
  return null;
}

export function evaluateDue(input: {
  record: InvestigationRecord;
  currentSlotId: string;
  phaseExists: boolean;
  alreadyAdvancedForSlot: boolean;
  dataConditionSatisfied: boolean;
}): InvestigationDueDecision {
  if (isTerminalInvestigationStatus(input.record.status)) {
    return 'terminal';
  }
  if (!input.phaseExists) {
    return 'missing_phase';
  }
  if (input.alreadyAdvancedForSlot) {
    return 'duplicate_slot';
  }

  if (input.record.status === 'awaiting_data' && !input.dataConditionSatisfied) {
    return 'awaiting_data';
  }

  if (input.record.nextEligibleSlot) {
    if (!slotGte(input.currentSlotId, input.record.nextEligibleSlot)) {
      return 'not_due';
    }
  }

  return 'due';
}

export function maxRetriesForPhase(phase: InvestigationPhaseDefinition): number {
  if (phase.retryPolicy !== 'bounded') {
    return 0;
  }
  const configured = phase.maxRetries ?? 0;
  return configured > 0 ? configured : 0;
}

export function classifyPhaseFailure(input: { phase: InvestigationPhaseDefinition; error: unknown }): InvestigationFailureDisposition {
  if (input.error instanceof Error && input.error.name === 'InvestigationAwaitingDataError') {
    return 'awaiting_data';
  }
  if (input.error instanceof Error && input.error.name === 'InvestigationNonRetryableError') {
    return 'non_retryable';
  }
  if (maxRetriesForPhase(input.phase) > 0) {
    return 'retryable';
  }
  return 'non_retryable';
}
