import { createMissionService } from '../operator/mission-service.ts';

import { evaluateAllSchedules } from './inspection.ts';
import { createScheduleLaunchJournal, type ScheduleLaunchJournal } from './journal.ts';
import { loadScheduleRegistry } from './registry.ts';
import type {
  MissionSchedule,
  ScheduleEvaluation,
  ScheduleInspection,
  ScheduleLaunchRecord,
  SchedulerTickResult
} from './types.ts';
import { buildScheduleInspections } from './inspection.ts';

export type MissionLaunchResult = {
  workflowRun?: unknown;
};

export type MissionLauncher = (input: {
  missionId: string;
  params: Record<string, string>;
}) => Promise<MissionLaunchResult>;

type SchedulerServiceOptions = {
  registryPath?: string;
  rootDir?: string;
  journal?: ScheduleLaunchJournal;
  missionLauncher?: MissionLauncher;
  now?: () => Date;
  missionServiceOptions?: {
    rootDir?: string;
    missionsDir?: string;
    missionTemplatesDir?: string;
    runtimeMissionsDir?: string;
    missionTeamRegistryPath?: string;
    missionTeamsDir?: string;
    missionAgentsDir?: string;
    teamsDir?: string;
    agentsDir?: string;
    workflowsDir?: string;
  };
};

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_error';
}

function sortLaunches(records: ScheduleLaunchRecord[]): ScheduleLaunchRecord[] {
  return [...records].sort((left, right) => {
    const scheduleCmp = left.scheduleId.localeCompare(right.scheduleId);
    if (scheduleCmp !== 0) {
      return scheduleCmp;
    }
    return left.slotId.localeCompare(right.slotId);
  });
}

export function createSchedulerService(options: SchedulerServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const journal = options.journal ?? createScheduleLaunchJournal({ rootDir: options.rootDir });

  const missionLauncher: MissionLauncher = options.missionLauncher
    ?? (async ({ missionId, params }) => {
      const missionService = createMissionService(options.missionServiceOptions ?? {});
      return missionService.startMission({ missionId, params });
    });

  function loadContext(): {
    schedulesById: Map<string, MissionSchedule>;
    evaluations: ScheduleEvaluation[];
    tickTimeUtc: Date;
  } {
    const registry = loadScheduleRegistry(options.registryPath);
    const tickTimeUtc = now();
    const evaluations = evaluateAllSchedules({
      registry,
      journal,
      tickTimeUtc
    });

    return {
      schedulesById: new Map(registry.schedules.map((schedule) => [schedule.scheduleId, schedule])),
      evaluations,
      tickTimeUtc
    };
  }

  async function tick(input: { dryRun?: boolean } = {}): Promise<SchedulerTickResult> {
    const context = loadContext();
    const launches: ScheduleLaunchRecord[] = [];

    for (const evaluation of context.evaluations) {
      if (evaluation.dueDecision !== 'due') {
        continue;
      }
      if (!evaluation.currentSlotId) {
        continue;
      }

      const schedule = context.schedulesById.get(evaluation.scheduleId);
      if (!schedule) {
        continue;
      }

      if (input.dryRun) {
        continue;
      }

      const recordedAt = now().toISOString();
      journal.appendAttempt({
        scheduleId: schedule.scheduleId,
        missionId: schedule.missionId,
        slotId: evaluation.currentSlotId,
        recordedAtUtc: recordedAt,
        dueDecision: 'due'
      });

      try {
        const launchResult = await missionLauncher({
          missionId: schedule.missionId,
          params: schedule.params ?? {}
        });

        const runId = typeof launchResult.workflowRun === 'string' ? launchResult.workflowRun : undefined;
        const completedAt = now().toISOString();
        if (runId) {
          journal.appendSuccess({
            scheduleId: schedule.scheduleId,
            missionId: schedule.missionId,
            slotId: evaluation.currentSlotId,
            runId,
            recordedAtUtc: completedAt
          });
        } else {
          journal.appendFailure({
            scheduleId: schedule.scheduleId,
            missionId: schedule.missionId,
            slotId: evaluation.currentSlotId,
            launchError: 'MISSION_LAUNCH_MISSING_RUN_ID',
            recordedAtUtc: completedAt
          });
        }
      } catch (error) {
        journal.appendFailure({
          scheduleId: schedule.scheduleId,
          missionId: schedule.missionId,
          slotId: evaluation.currentSlotId,
          launchError: asErrorMessage(error),
          recordedAtUtc: now().toISOString()
        });
      }

      const latestRecord = journal
        .listLaunchRecords(schedule.scheduleId)
        .filter((record) => record.slotId === evaluation.currentSlotId)
        .sort((left, right) => right.attemptedAtUtc.localeCompare(left.attemptedAtUtc))[0];

      if (latestRecord) {
        launches.push(latestRecord);
      }
    }

    const postTickContext = loadContext();

    return {
      tickTimeUtc: postTickContext.tickTimeUtc.toISOString(),
      evaluations: postTickContext.evaluations,
      launches: sortLaunches(launches)
    };
  }

  function listSchedules(input: { historyLimit?: number } = {}): ScheduleInspection[] {
    const registry = loadScheduleRegistry(options.registryPath);
    return buildScheduleInspections({
      registry,
      journal,
      tickTimeUtc: now(),
      historyLimit: input.historyLimit
    });
  }

  function inspectSchedule(input: { scheduleId: string; historyLimit?: number }): ScheduleInspection {
    const rows = listSchedules({ historyLimit: input.historyLimit });
    const found = rows.find((row) => row.scheduleId === input.scheduleId);
    if (!found) {
      throw new Error(`SCHEDULE_NOT_FOUND: ${input.scheduleId}`);
    }
    return found;
  }

  function listHistory(input: { scheduleId?: string; limit?: number } = {}): ScheduleLaunchRecord[] {
    const records = input.scheduleId
      ? journal.listLaunchRecords(input.scheduleId)
      : journal.listLaunchRecords();

    const sorted = [...records].sort((left, right) => {
      const scheduleCmp = left.scheduleId.localeCompare(right.scheduleId);
      if (scheduleCmp !== 0) {
        return scheduleCmp;
      }
      const slotCmp = right.slotId.localeCompare(left.slotId);
      if (slotCmp !== 0) {
        return slotCmp;
      }
      return right.attemptedAtUtc.localeCompare(left.attemptedAtUtc);
    });

    if (!input.limit) {
      return sorted;
    }

    return sorted.slice(0, input.limit);
  }

  return {
    tick,
    listSchedules,
    inspectSchedule,
    listHistory
  };
}

export type SchedulerService = ReturnType<typeof createSchedulerService>;
