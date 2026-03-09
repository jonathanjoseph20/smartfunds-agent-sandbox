import type { SlackNotificationPayload } from './slack-types.ts';

function formatArtifacts(artifacts: string[]): string[] {
  return Array.from(new Set(artifacts))
    .sort((left, right) => left.localeCompare(right));
}

export function formatMissionCompletionNotification(payload: SlackNotificationPayload): string {
  const artifacts = formatArtifacts(payload.artifacts);

  const lines = [
    'Mission completed',
    '',
    `mission: ${payload.missionId}`,
    `runId: ${payload.runId}`,
    '',
    'Artifacts available'
  ];

  if (artifacts.length === 0) {
    lines.push('none');
  } else {
    lines.push(...artifacts);
  }

  return lines.join('\n');
}

export function createSlackNotifier(input: {
  channel: string | null;
  sendMessage: (message: { channel: string; text: string }) => Promise<void>;
}) {
  async function notifyMissionCompleted(payload: SlackNotificationPayload): Promise<void> {
    if (!input.channel) {
      return;
    }

    await input.sendMessage({
      channel: input.channel,
      text: formatMissionCompletionNotification(payload)
    });
  }

  return {
    notifyMissionCompleted
  };
}

export type SlackNotifier = ReturnType<typeof createSlackNotifier>;
