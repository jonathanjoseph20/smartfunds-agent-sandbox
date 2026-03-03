import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../../finance/determinism.ts';
import { assertValidRun } from './run.schema.ts';
import type { Run } from './run.types.ts';

type CockpitRunsStorage = {
  runs: Run[];
};

function sortRuns(runs: Run[]): Run[] {
  return [...runs].sort((left, right) => {
    const projectCmp = left.projectId.localeCompare(right.projectId);
    if (projectCmp !== 0) {
      return projectCmp;
    }

    const goalCmp = left.goalId.localeCompare(right.goalId);
    if (goalCmp !== 0) {
      return goalCmp;
    }

    const teamCmp = left.teamId.localeCompare(right.teamId);
    if (teamCmp !== 0) {
      return teamCmp;
    }

    const attemptCmp = left.attemptIndex - right.attemptIndex;
    if (attemptCmp !== 0) {
      return attemptCmp;
    }

    return left.runId.localeCompare(right.runId);
  });
}

function stableRun(run: Run): Run {
  return {
    runId: run.runId,
    projectId: run.projectId,
    teamId: run.teamId,
    goalId: run.goalId,
    executionMode: run.executionMode,
    status: run.status,
    attemptIndex: run.attemptIndex
  };
}

function parseStorage(raw: unknown): CockpitRunsStorage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { runs: [] };
  }

  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.runs)) {
    return { runs: [] };
  }

  const runs = record.runs.filter((entry): entry is Run => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }
    const run = entry as Run;
    try {
      assertValidRun(run);
      return true;
    } catch {
      return false;
    }
  });

  return { runs: sortRuns(runs).map(stableRun) };
}

export type CockpitRunRepo = {
  createRun: (run: Run) => Run;
  getRun: (runId: string) => Run | null;
  listRunsByGoal: (goalId: string) => Run[];
  listRunsByProject: (projectId: string) => Run[];
  listRuns: () => Run[];
};

export function createCockpitRunRepo(options: { storagePath?: string } = {}): CockpitRunRepo {
  const storagePath = options.storagePath ?? path.resolve('control-plane/execution/storage/cockpit-runs.json');

  function ensureStorageExists(): void {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storagePath)) {
      fs.writeFileSync(storagePath, `${canonicalStringify({ runs: [] })}\n`, 'utf8');
    }
  }

  function readStorage(): CockpitRunsStorage {
    ensureStorageExists();
    const raw = JSON.parse(fs.readFileSync(storagePath, 'utf8')) as unknown;
    return parseStorage(raw);
  }

  function writeStorage(storage: CockpitRunsStorage): void {
    const payload: CockpitRunsStorage = {
      runs: sortRuns(storage.runs).map(stableRun)
    };
    fs.writeFileSync(storagePath, `${canonicalStringify(payload)}\n`, 'utf8');
  }

  function listRuns(): Run[] {
    return readStorage().runs.map(stableRun);
  }

  return {
    createRun(run: Run): Run {
      assertValidRun(run);
      const current = readStorage();
      const existing = current.runs.find((entry) => entry.runId === run.runId);
      if (existing) {
        return stableRun(existing);
      }

      const next = [...current.runs, stableRun(run)];
      writeStorage({ runs: next });
      return stableRun(run);
    },
    getRun(runId: string): Run | null {
      const found = readStorage().runs.find((entry) => entry.runId === runId);
      return found ? stableRun(found) : null;
    },
    listRunsByGoal(goalId: string): Run[] {
      return sortRuns(readStorage().runs.filter((entry) => entry.goalId === goalId)).map(stableRun);
    },
    listRunsByProject(projectId: string): Run[] {
      return sortRuns(readStorage().runs.filter((entry) => entry.projectId === projectId)).map(stableRun);
    },
    listRuns
  };
}
