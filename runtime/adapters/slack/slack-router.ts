import type { MissionController } from '../../mission/mission-controller.ts';
import type {
  MissionArtifactsCommand,
  MissionCommandName,
  MissionRunCommand,
  MissionStatusCommand,
  SlackCommandResult,
  SlackMissionCommand
} from './slack-types.ts';

const HELP_TEXT = [
  'Usage:',
  '/mission run <missionId>',
  '/mission status <runId>',
  '/mission artifacts <runId>'
].join('\n');

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeErrorMessage(message: string): string {
  const runNotFoundMatch = message.match(/^Run not found:\s*(.+)$/);
  if (runNotFoundMatch) {
    return `RUN_NOT_FOUND: ${runNotFoundMatch[1]}`;
  }

  return message;
}

function parseCommand(text: string): SlackMissionCommand {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length !== 2) {
    throw new Error(`INVALID_COMMAND: expected exactly 2 arguments\n\n${HELP_TEXT}`);
  }

  const commandName = tokens[0] as MissionCommandName;
  const value = tokens[1];

  if (commandName === 'run') {
    return {
      name: 'run',
      missionId: value
    } satisfies MissionRunCommand;
  }

  if (commandName === 'status') {
    return {
      name: 'status',
      runId: value
    } satisfies MissionStatusCommand;
  }

  if (commandName === 'artifacts') {
    return {
      name: 'artifacts',
      runId: value
    } satisfies MissionArtifactsCommand;
  }

  throw new Error(`INVALID_COMMAND: unknown subcommand ${tokens[0]}\n\n${HELP_TEXT}`);
}

export function createSlackRouter(controller: Pick<MissionController, 'startMission' | 'getRunStatus' | 'getArtifactsByRun'>) {
  async function routeMissionText(text: string): Promise<SlackCommandResult> {
    try {
      const command = parseCommand(text);

      if (command.name === 'run') {
        const started = asRecord(await controller.startMission(command.missionId));
        const missionId = asString(started.missionId) ?? command.missionId;
        const runId = asString(started.workflowRun);

        return {
          ok: true,
          text: [
            'Mission started',
            '',
            `mission: ${missionId}`,
            `runId: ${runId ?? 'unknown'}`
          ].join('\n')
        };
      }

      if (command.name === 'status') {
        const status = asRecord(controller.getRunStatus(command.runId));

        return {
          ok: true,
          text: [
            'Mission status',
            '',
            `runId: ${command.runId}`,
            `status: ${asString(status.status) ?? 'unknown'}`,
            `phase: ${asString(status.phase) ?? 'none'}`
          ].join('\n')
        };
      }

      const artifactsResponse = asRecord(controller.getArtifactsByRun(command.runId));
      const artifacts = Array.isArray(artifactsResponse.artifacts)
        ? (artifactsResponse.artifacts.filter((entry) => typeof entry === 'string') as string[])
            .sort((left, right) => left.localeCompare(right))
        : [];

      return {
        ok: true,
        text: [
          'Artifacts',
          '',
          ...(artifacts.length > 0 ? artifacts : ['none'])
        ].join('\n')
      };
    } catch (error) {
      const message = error instanceof Error ? normalizeErrorMessage(error.message) : 'unknown_error';
      return {
        ok: false,
        text: [
          'Error',
          '',
          message
        ].join('\n')
      };
    }
  }

  return {
    routeMissionText,
    helpText: HELP_TEXT
  };
}

export type SlackRouter = ReturnType<typeof createSlackRouter>;
