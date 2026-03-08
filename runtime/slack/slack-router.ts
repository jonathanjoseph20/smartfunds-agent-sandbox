import type { MissionController } from '../mission/mission-controller.ts';
import {
  formatArtifactList,
  formatMissionCancelled,
  formatMissionList,
  formatMissionLogs,
  formatMissionStarted,
  formatMissionStatus,
  type SlackMessage
} from './slack-format.ts';

export type SlackRouteResult =
  | { ok: true; message: SlackMessage; artifacts?: string[] }
  | { ok: false; error: { code: string; message: string } };

type SlackRouterOptions = {
  listMissions?: () => unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toError(code: string, message: string): SlackRouteResult {
  return {
    ok: false,
    error: { code, message }
  };
}

export function createSlackRouter(controller: MissionController, options: SlackRouterOptions = {}) {
  async function handleCommand(command: '/mission' | '/artifact', args: string[]): Promise<SlackRouteResult> {
    try {
      if (command === '/artifact') {
        const missionId = args[0];
        if (!missionId) {
          return toError('MISSING_ARGUMENT', 'Missing required <mission-id> for /artifact');
        }

        const artifactsResult = asRecord(controller.getArtifacts(missionId));
        const artifacts = Array.isArray(artifactsResult.artifacts)
          ? artifactsResult.artifacts.filter((entry) => typeof entry === 'string') as string[]
          : [];

        return {
          ok: true,
          message: formatArtifactList({ missionId, artifacts }),
          artifacts
        };
      }

      const subcommand = args[0];
      if (!subcommand) {
        return toError('MISSING_SUBCOMMAND', 'Missing mission subcommand');
      }

      if (subcommand === 'run') {
        const missionId = args[1];
        if (!missionId) {
          return toError('MISSING_ARGUMENT', 'Missing required <mission-name> for /mission run');
        }

        const started = asRecord(await controller.startMission(missionId));
        return {
          ok: true,
          message: formatMissionStarted({
            missionId,
            runId: asString(started.workflowRun),
            teamId: asString(started.teamId),
            status: asString(started.status),
            agents: null
          })
        };
      }

      if (subcommand === 'status') {
        const missionId = args[1];
        if (!missionId) {
          return toError('MISSING_ARGUMENT', 'Missing required <mission-id> for /mission status');
        }

        const status = asRecord(controller.getStatus(missionId));
        const nodeStates = Array.isArray(status.nodeStates) ? status.nodeStates.length : 0;
        const progress = nodeStates === 0 ? 0 : 1;

        return {
          ok: true,
          message: formatMissionStatus({
            missionId,
            status: asString(status.status) ?? 'created',
            agents: [],
            progress
          })
        };
      }

      if (subcommand === 'list') {
        const list = options.listMissions ? options.listMissions() : [];
        const missions = Array.isArray(list)
          ? list.filter((entry) => entry && typeof entry === 'object').map((entry) => {
            const row = entry as Record<string, unknown>;
            return {
              missionId: asString(row.missionId) ?? 'unknown',
              status: asString(row.status) ?? 'created'
            };
          })
          : [];

        return {
          ok: true,
          message: formatMissionList(missions)
        };
      }

      if (subcommand === 'logs') {
        const missionId = args[1];
        if (!missionId) {
          return toError('MISSING_ARGUMENT', 'Missing required <mission-id> for /mission logs');
        }

        const trace = asRecord(controller.getLogs(missionId));
        const traceItems = Array.isArray(trace.trace) ? trace.trace : [];

        return {
          ok: true,
          message: formatMissionLogs({
            missionId,
            runId: asString(trace.runId),
            eventCount: traceItems.length
          })
        };
      }

      if (subcommand === 'cancel') {
        const missionId = args[1];
        if (!missionId) {
          return toError('MISSING_ARGUMENT', 'Missing required <mission-id> for /mission cancel');
        }

        const cancelled = asRecord(controller.cancelMission(missionId));
        return {
          ok: true,
          message: formatMissionCancelled({
            missionId,
            runId: asString(cancelled.runId)
          })
        };
      }

      return toError('UNKNOWN_SUBCOMMAND', `Unknown mission subcommand: ${subcommand}`);
    } catch (error) {
      return toError('CONTROLLER_ERROR', error instanceof Error ? error.message : 'unknown_error');
    }
  }

  return {
    handleCommand
  };
}

export type SlackRouter = ReturnType<typeof createSlackRouter>;
