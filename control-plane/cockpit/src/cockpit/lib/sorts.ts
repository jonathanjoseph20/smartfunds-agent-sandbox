import type { Mission, WorkflowRun, MissionStatus, RunStatus } from './types';

const missionStatusOrder: Record<MissionStatus, number> = {
  running: 0,
  created: 1,
  failed: 2,
  cancelled: 3,
  completed: 4,
};

const runStatusOrder: Record<RunStatus, number> = {
  running: 0,
  retrying: 1,
  recovering: 2,
  created: 3,
  failed: 4,
  timed_out: 5,
  cancelled: 6,
  recovered: 7,
  completed: 8,
};

export function sortMissions(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    const statusDiff = (missionStatusOrder[a.status] ?? 99) - (missionStatusOrder[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return a.missionId.localeCompare(b.missionId);
  });
}

export function sortRuns(runs: WorkflowRun[]): WorkflowRun[] {
  return [...runs].sort((a, b) => {
    const statusDiff = (runStatusOrder[a.status] ?? 99) - (runStatusOrder[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return a.runId.localeCompare(b.runId);
  });
}
