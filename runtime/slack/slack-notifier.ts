import type { SlackClient } from './slack-client.ts';
import {
  formatArtifactList,
  formatMissionStarted,
  formatMissionStatus,
  type SlackMessage
} from './slack-format.ts';

export type MissionLifecycleEvent = 'mission_started' | 'mission_completed' | 'mission_failed' | 'artifact_ready';

function eventToMessage(event: MissionLifecycleEvent, payload: Record<string, unknown>): SlackMessage {
  const missionId = typeof payload.missionId === 'string' ? payload.missionId : 'unknown-mission';

  if (event === 'mission_started') {
    return formatMissionStarted({
      missionId,
      runId: typeof payload.runId === 'string' ? payload.runId : null,
      teamId: typeof payload.teamId === 'string' ? payload.teamId : null,
      status: 'running',
      agents: typeof payload.agents === 'number' ? payload.agents : null
    });
  }

  if (event === 'mission_completed') {
    return formatMissionStatus({
      missionId,
      status: 'completed',
      progress: 1,
      agents: []
    });
  }

  if (event === 'mission_failed') {
    return formatMissionStatus({
      missionId,
      status: 'failed',
      progress: 0,
      agents: []
    });
  }

  const artifacts = Array.isArray(payload.artifacts)
    ? payload.artifacts.filter((entry) => typeof entry === 'string') as string[]
    : [];

  return formatArtifactList({ missionId, artifacts });
}

export function createSlackNotifier(client: SlackClient, channel: string) {
  async function notify(event: MissionLifecycleEvent, payload: Record<string, unknown>): Promise<void> {
    const message = eventToMessage(event, payload);
    await client.postMessage(channel, message.blocks);
  }

  return {
    notify
  };
}

export type SlackNotifier = ReturnType<typeof createSlackNotifier>;
