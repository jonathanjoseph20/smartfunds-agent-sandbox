import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import type { DueDecision, ScheduleLaunchEvent, ScheduleLaunchRecord } from './types.ts';

const DEFAULT_ROOT_DIR = path.resolve('runtime-data/scheduler');
const LAUNCH_EVENTS_FILE = 'launch-events.json';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureFile(filePath: string, defaultJson: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${defaultJson}\n`, 'utf8');
  }
}

function normalizeEvent(event: ScheduleLaunchEvent): ScheduleLaunchEvent {
  return {
    sequence: event.sequence,
    scheduleId: event.scheduleId,
    missionId: event.missionId,
    slotId: event.slotId,
    eventType: event.eventType,
    recordedAtUtc: event.recordedAtUtc,
    dueDecision: event.dueDecision,
    ...(event.runId ? { runId: event.runId } : {}),
    ...(event.launchError ? { launchError: event.launchError } : {})
  };
}

function sortEvents(events: ScheduleLaunchEvent[]): ScheduleLaunchEvent[] {
  return [...events]
    .map(normalizeEvent)
    .sort((left, right) => left.sequence - right.sequence);
}

function toLaunchRecords(events: ScheduleLaunchEvent[]): ScheduleLaunchRecord[] {
  const attempts = sortEvents(events).filter((event) => event.eventType === 'ATTEMPT_RECORDED');
  const completions = sortEvents(events).filter((event) => event.eventType !== 'ATTEMPT_RECORDED');

  const completionByKey = new Map<string, ScheduleLaunchEvent>();
  for (const completion of completions) {
    completionByKey.set(`${completion.scheduleId}::${completion.slotId}`, completion);
  }

  return attempts.map((attempt) => {
    const completion = completionByKey.get(`${attempt.scheduleId}::${attempt.slotId}`);
    const launched = completion?.eventType === 'LAUNCH_SUCCEEDED';

    return {
      scheduleId: attempt.scheduleId,
      missionId: attempt.missionId,
      slotId: attempt.slotId,
      dueDecision: attempt.dueDecision,
      launched,
      ...(completion?.runId ? { runId: completion.runId } : {}),
      ...(completion?.launchError ? { launchError: completion.launchError } : {}),
      attemptedAtUtc: attempt.recordedAtUtc,
      ...(completion ? { completedAtUtc: completion.recordedAtUtc } : {})
    };
  }).sort((left, right) => {
    const scheduleCmp = left.scheduleId.localeCompare(right.scheduleId);
    if (scheduleCmp !== 0) {
      return scheduleCmp;
    }
    return left.slotId.localeCompare(right.slotId);
  });
}

export type ScheduleLaunchJournal = {
  listEvents: () => ScheduleLaunchEvent[];
  hasAttemptForSlot: (scheduleId: string, slotId: string) => boolean;
  appendAttempt: (input: {
    scheduleId: string;
    missionId: string;
    slotId: string;
    recordedAtUtc: string;
    dueDecision?: DueDecision;
  }) => ScheduleLaunchEvent;
  appendSuccess: (input: {
    scheduleId: string;
    missionId: string;
    slotId: string;
    runId: string;
    recordedAtUtc: string;
  }) => ScheduleLaunchEvent;
  appendFailure: (input: {
    scheduleId: string;
    missionId: string;
    slotId: string;
    launchError: string;
    recordedAtUtc: string;
  }) => ScheduleLaunchEvent;
  listLaunchRecords: (scheduleId?: string) => ScheduleLaunchRecord[];
};

export function createScheduleLaunchJournal(options: { rootDir?: string } = {}): ScheduleLaunchJournal {
  const rootDir = options.rootDir ?? DEFAULT_ROOT_DIR;
  ensureDir(rootDir);

  const eventsPath = path.join(rootDir, LAUNCH_EVENTS_FILE);
  ensureFile(eventsPath, canonicalStringify([]));

  function readEvents(): ScheduleLaunchEvent[] {
    const raw = JSON.parse(fs.readFileSync(eventsPath, 'utf8')) as ScheduleLaunchEvent[];
    return sortEvents(raw);
  }

  function writeEvents(events: ScheduleLaunchEvent[]): void {
    fs.writeFileSync(eventsPath, `${canonicalStringify(sortEvents(events))}\n`, 'utf8');
  }

  function appendEvent(input: Omit<ScheduleLaunchEvent, 'sequence'>): ScheduleLaunchEvent {
    const existing = readEvents();
    const next: ScheduleLaunchEvent = {
      sequence: existing.length + 1,
      ...input
    };
    writeEvents([...existing, next]);
    return next;
  }

  function hasAttemptForSlot(scheduleId: string, slotId: string): boolean {
    return readEvents().some((event) => (
      event.scheduleId === scheduleId
      && event.slotId === slotId
      && event.eventType === 'ATTEMPT_RECORDED'
    ));
  }

  function appendAttempt(input: {
    scheduleId: string;
    missionId: string;
    slotId: string;
    recordedAtUtc: string;
    dueDecision?: DueDecision;
  }): ScheduleLaunchEvent {
    if (hasAttemptForSlot(input.scheduleId, input.slotId)) {
      const existing = readEvents().find((event) => (
        event.scheduleId === input.scheduleId
        && event.slotId === input.slotId
        && event.eventType === 'ATTEMPT_RECORDED'
      ));
      if (!existing) {
        throw new Error('scheduler_journal_invariant_violation');
      }
      return existing;
    }

    return appendEvent({
      scheduleId: input.scheduleId,
      missionId: input.missionId,
      slotId: input.slotId,
      eventType: 'ATTEMPT_RECORDED',
      recordedAtUtc: input.recordedAtUtc,
      dueDecision: input.dueDecision ?? 'due'
    });
  }

  function appendSuccess(input: {
    scheduleId: string;
    missionId: string;
    slotId: string;
    runId: string;
    recordedAtUtc: string;
  }): ScheduleLaunchEvent {
    return appendEvent({
      scheduleId: input.scheduleId,
      missionId: input.missionId,
      slotId: input.slotId,
      eventType: 'LAUNCH_SUCCEEDED',
      recordedAtUtc: input.recordedAtUtc,
      dueDecision: 'due',
      runId: input.runId
    });
  }

  function appendFailure(input: {
    scheduleId: string;
    missionId: string;
    slotId: string;
    launchError: string;
    recordedAtUtc: string;
  }): ScheduleLaunchEvent {
    return appendEvent({
      scheduleId: input.scheduleId,
      missionId: input.missionId,
      slotId: input.slotId,
      eventType: 'LAUNCH_FAILED',
      recordedAtUtc: input.recordedAtUtc,
      dueDecision: 'due',
      launchError: input.launchError
    });
  }

  function listLaunchRecords(scheduleId?: string): ScheduleLaunchRecord[] {
    const records = toLaunchRecords(readEvents());
    if (!scheduleId) {
      return records;
    }
    return records.filter((record) => record.scheduleId === scheduleId);
  }

  return {
    listEvents: readEvents,
    hasAttemptForSlot,
    appendAttempt,
    appendSuccess,
    appendFailure,
    listLaunchRecords
  };
}
