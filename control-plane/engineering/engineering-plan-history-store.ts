import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { EngineeringPlanHistoryEvent } from './engineering-plan-types.ts';

const EVENT_TYPE_ORDER: Record<EngineeringPlanHistoryEvent['eventType'], number> = {
  engineering_plan_created: 0,
  engineering_plan_updated: 1,
  engineering_plan_validated: 2,
  engineering_plan_status_changed: 3,
};

const DEFAULT_ENGINEERING_PLAN_HISTORY_FILE = path.join('runtime-data', 'engineering', 'engineering-plan-history.json');

type EngineeringPlanHistoryRecord = {
  entries: EngineeringPlanHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): EngineeringPlanHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('ENGINEERING_PLAN_INVALID_HISTORY_EVENT');
  }

  const eventType = asString(value.eventType) as EngineeringPlanHistoryEvent['eventType'];
  const planId = asString(value.planId);
  const payloadHash = asString(value.payloadHash);

  if (!eventType || !planId || !payloadHash) {
    throw new Error('ENGINEERING_PLAN_INVALID_HISTORY_EVENT');
  }

  return {
    eventType,
    planId,
    payloadHash,
  };
}

function computeEventHash(event: EngineeringPlanHistoryEvent): string {
  return sha256(canonicalStringify({
    eventType: event.eventType,
    planId: event.planId,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: EngineeringPlanHistoryEvent, right: EngineeringPlanHistoryEvent): number {
  const planCmp = left.planId.localeCompare(right.planId);
  if (planCmp !== 0) {
    return planCmp;
  }

  const typeCmp = EVENT_TYPE_ORDER[left.eventType] - EVENT_TYPE_ORDER[right.eventType];
  if (typeCmp !== 0) {
    return typeCmp;
  }

  const payloadCmp = left.payloadHash.localeCompare(right.payloadHash);
  if (payloadCmp !== 0) {
    return payloadCmp;
  }

  return computeEventHash(left).localeCompare(computeEventHash(right));
}

function readHistory(filePath: string): EngineeringPlanHistoryRecord {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('ENGINEERING_PLAN_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createEngineeringPlanHistoryStore(options: { historyFilePath?: string } = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_ENGINEERING_PLAN_HISTORY_FILE;

  function appendEngineeringPlanEvent(event: EngineeringPlanHistoryEvent): {
    appended: boolean;
    event: EngineeringPlanHistoryEvent;
    entries: EngineeringPlanHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const current = readHistory(historyFilePath);
    const nextHash = computeEventHash(event);

    if (current.entries.some((entry) => computeEventHash(entry) === nextHash)) {
      return {
        appended: false,
        event,
        entries: current.entries,
      };
    }

    const entries = [...current.entries, event].sort(compareEvents);
    fs.writeFileSync(historyFilePath, `${canonicalStringify({ entries })}\n`, 'utf8');

    return {
      appended: true,
      event,
      entries,
    };
  }

  function listEngineeringPlanEvents(planId: string): EngineeringPlanHistoryEvent[] {
    return readHistory(historyFilePath)
      .entries
      .filter((entry) => entry.planId === planId)
      .sort(compareEvents);
  }

  function listAllEngineeringPlanEvents(): EngineeringPlanHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendEngineeringPlanEvent,
    listEngineeringPlanEvents,
    listAllEngineeringPlanEvents,
  };
}

const defaultStore = createEngineeringPlanHistoryStore();

export function appendEngineeringPlanEvent(event: EngineeringPlanHistoryEvent) {
  return defaultStore.appendEngineeringPlanEvent(event);
}

export function listEngineeringPlanEvents(planId: string): EngineeringPlanHistoryEvent[] {
  return defaultStore.listEngineeringPlanEvents(planId);
}

export type EngineeringPlanHistoryStore = ReturnType<typeof createEngineeringPlanHistoryStore>;
