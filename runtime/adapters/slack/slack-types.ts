export type MissionCommandName = 'run' | 'status' | 'artifacts';

export type MissionRunCommand = {
  name: 'run';
  missionId: string;
};

export type MissionStatusCommand = {
  name: 'status';
  runId: string;
};

export type MissionArtifactsCommand = {
  name: 'artifacts';
  runId: string;
};

export type SlackMissionCommand = MissionRunCommand | MissionStatusCommand | MissionArtifactsCommand;

export type SlackArtifactSummary = {
  missionId: string;
  runId: string;
  artifacts: string[];
};

export type SlackMissionStatusSummary = {
  runId: string;
  status: string;
  phase: string | null;
};

export type SlackNotificationPayload = {
  missionId: string;
  runId: string;
  artifacts: string[];
};

export type SlackCommandResult =
  | {
    ok: true;
    text: string;
  }
  | {
    ok: false;
    text: string;
  };
