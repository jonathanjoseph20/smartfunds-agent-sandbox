import { canonicalStringify } from '../finance/determinism.ts';

import {
  EXECUTION_JOURNAL_EVENT_TYPES,
  EXECUTION_JOURNAL_RESERVED_EVENT_TYPES,
  type ExecutionJournalEventType,
  type ReservedExecutionJournalEventType,
} from './execution-journal-types.ts';

const EVENT_TYPE_SET = new Set<string>(EXECUTION_JOURNAL_EVENT_TYPES);
const RESERVED_EVENT_TYPE_SET = new Set<string>(EXECUTION_JOURNAL_RESERVED_EVENT_TYPES);

export function isValidExecutionJournalEventType(value: string): value is ExecutionJournalEventType {
  return EVENT_TYPE_SET.has(value);
}

export function isReservedExecutionJournalEventType(value: string): value is ReservedExecutionJournalEventType {
  return RESERVED_EVENT_TYPE_SET.has(value);
}

export function normalizeEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}
