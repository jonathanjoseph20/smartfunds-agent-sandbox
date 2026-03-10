import { createArtifactId } from './ids.ts';
import { createJournalStorage, type JournalStorage } from './storage.ts';
import type { AppendEventInput, ExecutionEvent, ExecutionRun, RunKind, RunSummary } from './types.ts';
import { loadOwnershipProjects } from '../studio/registry.ts';

type JournalOptions = {
  rootDir?: string;
  storage?: JournalStorage;
};

function resolveProjectContext(projectId: string): { entity: string; pod: string; mode: string } {
  const project = loadOwnershipProjects().find((entry) => entry.projectId === projectId);
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`);
  }

  return {
    entity: project.entityId ?? 'unknown-entity',
    pod: project.podId ?? 'unknown-pod',
    mode: project.mode ?? 'structured'
  };
}

export type ExecutionJournal = {
  createRun: (input: {
    projectId: string;
    kind: RunKind;
    entrypoint: string;
    profile?: string;
    executionPath?: 'governed' | 'lite' | 'build';
  }) => ExecutionRun;
  appendEvent: (input: {
    runId: string;
    type: AppendEventInput['type'];
    phase: AppendEventInput['phase'];
    taskId?: string | null;
    artifactId?: string | null;
    payload?: Record<string, unknown>;
  }) => ExecutionEvent;
  inspectRun: (runId: string) => { run: ExecutionRun; events: ExecutionEvent[] };
  summarizeRun: (runId: string) => RunSummary;
  listRuns: () => ExecutionRun[];
};

export function createExecutionJournal(options: JournalOptions = {}): ExecutionJournal {
  const storage = options.storage ?? createJournalStorage({ rootDir: options.rootDir });

  function createRun(input: {
    projectId: string;
    kind: RunKind;
    entrypoint: string;
    profile?: string;
    executionPath?: 'governed' | 'lite' | 'build';
  }): ExecutionRun {
    const context = resolveProjectContext(input.projectId);

    return storage.createRun({
      projectId: input.projectId,
      kind: input.kind,
      entrypoint: input.entrypoint,
      entity: context.entity,
      pod: context.pod,
      mode: context.mode,
      ...(input.profile ? { profile: input.profile } : {}),
      ...(input.executionPath ? { executionPath: input.executionPath } : {})
    });
  }

  function appendEvent(input: {
    runId: string;
    type: AppendEventInput['type'];
    phase: AppendEventInput['phase'];
    taskId?: string | null;
    artifactId?: string | null;
    payload?: Record<string, unknown>;
  }): ExecutionEvent {
    const nextSequence = storage.getEvents(input.runId).length + 1;
    const artifactId = input.type === 'ARTIFACT_RECORDED'
      ? (input.artifactId ?? createArtifactId(input.runId, nextSequence))
      : (input.artifactId ?? null);

    return storage.appendEvent(input.runId, {
      sequence: nextSequence,
      type: input.type,
      phase: input.phase,
      taskId: input.taskId ?? null,
      artifactId,
      payload: input.payload ?? {}
    });
  }

  function inspectRun(runId: string): { run: ExecutionRun; events: ExecutionEvent[] } {
    const run = storage.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    return {
      run,
      events: storage.getEvents(runId)
    };
  }

  function summarizeRun(runId: string): RunSummary {
    return storage.getSummary(runId);
  }

  return {
    createRun,
    appendEvent,
    inspectRun,
    summarizeRun,
    listRuns: () => storage.listRuns()
  };
}
