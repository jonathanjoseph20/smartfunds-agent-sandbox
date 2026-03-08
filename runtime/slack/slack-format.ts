export type SlackBlock = Record<string, unknown>;

export type SlackMessage = {
  text: string;
  blocks: SlackBlock[];
};

function progressBar(value: number): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const filled = Math.round(clamped * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

function section(text: string): SlackBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text
    }
  };
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts.at(-1) ?? filePath;
}

function extensionLabel(filePath: string): string {
  const name = basename(filePath);
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) {
    return 'artifact';
  }
  return name.slice(dot + 1).toUpperCase();
}

export function formatMissionStarted(input: {
  missionId: string;
  teamId?: string | null;
  agents?: number | null;
  status?: string | null;
  runId?: string | null;
}): SlackMessage {
  return {
    text: `Mission started: ${input.missionId}`,
    blocks: [
      section('*Mission started*'),
      section([
        `Mission ID: ${input.missionId}`,
        `Run ID: ${input.runId ?? 'n/a'}`,
        `Team: ${input.teamId ?? 'n/a'}`,
        `Agents: ${String(input.agents ?? 0)}`,
        `Status: ${input.status ?? 'running'}`
      ].join('\n'))
    ]
  };
}

export function formatMissionStatus(input: {
  missionId: string;
  status: string;
  agents?: string[] | null;
  progress?: number | null;
}): SlackMessage {
  const normalizedProgress = Math.min(1, Math.max(0, Number.isFinite(input.progress) ? (input.progress as number) : 0));

  return {
    text: `Mission status: ${input.missionId} (${input.status})`,
    blocks: [
      section('*Mission status*'),
      section([
        `Mission: ${input.missionId}`,
        `Status: ${input.status}`,
        `Agents: ${input.agents && input.agents.length > 0 ? input.agents.join(', ') : 'n/a'}`,
        `Progress: ${progressBar(normalizedProgress)} ${Math.round(normalizedProgress * 100)}%`
      ].join('\n'))
    ]
  };
}

export function formatMissionList(missions: Array<{ missionId: string; status: string }>): SlackMessage {
  const rows = missions
    .slice()
    .sort((left, right) => left.missionId.localeCompare(right.missionId))
    .map((mission) => `- ${mission.missionId}: ${mission.status}`);

  return {
    text: `Mission list (${missions.length})`,
    blocks: [
      section('*Mission list*'),
      section(rows.length > 0 ? rows.join('\n') : 'No missions found.')
    ]
  };
}

export function formatMissionLogs(input: { missionId: string; runId?: string | null; eventCount?: number | null }): SlackMessage {
  return {
    text: `Mission logs: ${input.missionId}`,
    blocks: [
      section('*Mission logs*'),
      section([
        `Mission: ${input.missionId}`,
        `Run: ${input.runId ?? 'n/a'}`,
        `Events: ${String(input.eventCount ?? 0)}`
      ].join('\n'))
    ]
  };
}

export function formatMissionCancelled(input: { missionId: string; runId?: string | null }): SlackMessage {
  return {
    text: `Mission cancelled: ${input.missionId}`,
    blocks: [
      section('*Mission cancelled*'),
      section([
        `Mission ID: ${input.missionId}`,
        `Run ID: ${input.runId ?? 'n/a'}`
      ].join('\n'))
    ]
  };
}

export function formatArtifactList(input: { missionId: string; artifacts: string[] }): SlackMessage {
  const items = input.artifacts.slice().sort((left, right) => left.localeCompare(right));
  const blocks: SlackBlock[] = [
    section('*Artifacts ready*'),
    section([
      `Mission: ${input.missionId}`,
      ...(items.length > 0 ? items.map((artifact) => `- ${artifact}`) : ['No artifacts found.'])
    ].join('\n'))
  ];

  for (const artifact of items) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Download ${extensionLabel(artifact)}`
          },
          action_id: 'artifact_get',
          value: artifact
        }
      ]
    });
  }

  return {
    text: `Artifacts for ${input.missionId}`,
    blocks
  };
}
