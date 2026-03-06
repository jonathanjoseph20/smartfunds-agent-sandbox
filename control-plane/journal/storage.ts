import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import { createEventId, createRunId, parseRunCounter } from './ids.ts';
import { reduceRunSummary } from './reducer.ts';
import type {
  AppendEventInput,
  CreateRunInput,
  ExecutionEvent,
  ExecutionRun,
  RunSummary
} from './types.ts';

type JournalStorageOptions = {
  rootDir?: string;
};

const DEFAULT_ROOT_DIR = path.resolve('runtime-data/journal');

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

function normalizeEvent(event: ExecutionEvent): ExecutionEvent {
  return {
    runId: event.runId,
    eventId: event.eventId,
    sequence: event.sequence,
    type: event.type,
    phase: event.phase,
    taskId: event.taskId ?? null,
    artifactId: event.artifactId ?? null,
    payload: event.payload
  };
}

function normalizeRun(run: ExecutionRun): ExecutionRun {
  return {
    runId: run.runId,
    projectId: run.projectId,
    entity: run.entity,
    pod: run.pod,
    mode: run.mode,
    kind: run.kind,
    status: run.status,
    entrypoint: run.entrypoint,
    createdIndex: run.createdIndex
  };
}

export type JournalStorage = {
  createRun: (input: CreateRunInput) => ExecutionRun;
  appendEvent: (runId: string, input: AppendEventInput) => ExecutionEvent;
  getRun: (runId: string) => ExecutionRun | null;
  getEvents: (runId: string) => ExecutionEvent[];
  getSummary: (runId: string) => RunSummary;
  listRuns: () => ExecutionRun[];
};

export function createJournalStorage(options: JournalStorageOptions = {}): JournalStorage {
  const rootDir = options.rootDir ?? DEFAULT_ROOT_DIR;
  const runsDir = path.join(rootDir, 'runs');
  const eventsDir = path.join(rootDir, 'events');

  ensureDir(rootDir);
  ensureDir(runsDir);
  ensureDir(eventsDir);

  function runPath(runId: string): string {
    return path.join(runsDir, `${runId}.json`);
  }

  function eventsPath(runId: string): string {
    return path.join(eventsDir, `${runId}.json`);
  }

  function readRun(runId: string): ExecutionRun | null {
    const filePath = runPath(runId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ExecutionRun;
    return normalizeRun(parsed);
  }

  function writeRun(run: ExecutionRun): void {
    fs.writeFileSync(runPath(run.runId), `${canonicalStringify(normalizeRun(run))}\n`, 'utf8');
  }

  function readEvents(runId: string): ExecutionEvent[] {
    const filePath = eventsPath(runId);
    ensureFile(filePath, canonicalStringify([]));
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ExecutionEvent[];
    const normalized = parsed.map(normalizeEvent).sort((left, right) => left.sequence - right.sequence);
    return normalized;
  }

  function writeEvents(runId: string, events: ExecutionEvent[]): void {
    const ordered = [...events]
      .map(normalizeEvent)
      .sort((left, right) => left.sequence - right.sequence);
    fs.writeFileSync(eventsPath(runId), `${canonicalStringify(ordered)}\n`, 'utf8');
  }

  function listRuns(): ExecutionRun[] {
    const files = fs
      .readdirSync(runsDir)
      .filter((entry) => entry.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));

    return files
      .map((file) => JSON.parse(fs.readFileSync(path.join(runsDir, file), 'utf8')) as ExecutionRun)
      .map(normalizeRun)
      .sort((left, right) => {
        const indexCmp = left.createdIndex - right.createdIndex;
        if (indexCmp !== 0) {
          return indexCmp;
        }
        return left.runId.localeCompare(right.runId);
      });
  }

  function nextRunCounter(projectId: string): number {
    const counters = listRuns()
      .map((run) => parseRunCounter(run.runId, projectId))
      .filter((value): value is number => value !== null);

    if (counters.length === 0) {
      return 1;
    }

    return Math.max(...counters) + 1;
  }

  function createRun(input: CreateRunInput): ExecutionRun {
    const runs = listRuns();
    const counter = nextRunCounter(input.projectId);
    const run: ExecutionRun = {
      runId: createRunId(input.projectId, counter),
      projectId: input.projectId,
      entity: input.entity,
      pod: input.pod,
      mode: input.mode,
      kind: input.kind,
      status: 'pending',
      entrypoint: input.entrypoint,
      createdIndex: runs.length + 1
    };

    writeRun(run);
    writeEvents(run.runId, []);
    return run;
  }

  function appendEvent(runId: string, input: AppendEventInput): ExecutionEvent {
    const run = readRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const events = readEvents(runId);
    const expectedSequence = events.length + 1;
    if (input.sequence !== expectedSequence) {
      throw new Error(`Invalid sequence for ${runId}: expected ${expectedSequence}, received ${input.sequence}.`);
    }

    if (events.some((event) => event.sequence === input.sequence)) {
      throw new Error(`Duplicate sequence for ${runId}: ${input.sequence}.`);
    }

    const event: ExecutionEvent = {
      runId,
      eventId: createEventId(runId, input.sequence),
      sequence: input.sequence,
      type: input.type,
      phase: input.phase,
      taskId: input.taskId ?? null,
      artifactId: input.artifactId ?? null,
      payload: input.payload ?? {}
    };

    writeEvents(runId, [...events, event]);
    return event;
  }

  function getRun(runId: string): ExecutionRun | null {
    return readRun(runId);
  }

  function getEvents(runId: string): ExecutionEvent[] {
    const run = readRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    return readEvents(runId);
  }

  function getSummary(runId: string): RunSummary {
    const run = readRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    return reduceRunSummary(run, readEvents(runId));
  }

  return {
    createRun,
    appendEvent,
    getRun,
    getEvents,
    getSummary,
    listRuns
  };
}
