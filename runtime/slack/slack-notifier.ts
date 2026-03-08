import type { SlackClient } from './slack-client.ts';
import {
  formatArtifactList,
  type SlackMessage
} from './slack-format.ts';
import { formatSlackProgress, type SlackProgressEventType } from './slack-progress.ts';
import { formatSlackRunSummary } from './slack-run-summary.ts';

export type MissionLifecycleEvent =
  | 'mission_started'
  | 'step_started'
  | 'step_completed'
  | 'mission_completed'
  | 'mission_failed'
  | 'artifact_ready';

function eventToMessage(event: MissionLifecycleEvent, payload: Record<string, unknown>): SlackMessage {
  const missionId = typeof payload.missionId === 'string' ? payload.missionId : 'unknown-mission';

  if (event === 'mission_started' || event === 'step_started' || event === 'step_completed') {
    return formatSlackProgress(event as SlackProgressEventType, {
      missionId,
      stepName: typeof payload.stepName === 'string' ? payload.stepName : null,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : null,
      totalSteps: typeof payload.totalSteps === 'number' ? payload.totalSteps : null,
      status: typeof payload.status === 'string' ? payload.status : null
    });
  }

  if (event === 'mission_completed') {
    return formatSlackRunSummary({
      missionId,
      status: 'completed',
      resultCounts: payload.resultCounts as Record<string, unknown> | null,
      artifacts: Array.isArray(payload.artifacts) ? payload.artifacts : null
    });
  }

  if (event === 'mission_failed') {
    return formatSlackRunSummary({
      missionId,
      status: 'failed',
      failureCode: typeof payload.failureCode === 'string' ? payload.failureCode : null,
      failureMessage: typeof payload.failureMessage === 'string' ? payload.failureMessage : null
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
