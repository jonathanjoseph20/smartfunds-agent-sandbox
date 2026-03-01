import type { RunLifecycleState } from '../../../execution/run-lifecycle.ts';
import type { RunRecord } from '../../../execution/types.ts';

export type SlackWebhookType = 'slack_actions' | 'slack_events';

export interface SlackBlockAction {
  action_id?: string;
  value?: string;
}

export interface SlackActionPayload {
  type?: string;
  team?: { id?: string };
  user?: { id?: string };
  actions?: SlackBlockAction[];
  channel?: { id?: string };
  message?: { ts?: string };
  trigger_id?: string;
}

export interface SlackEventEnvelope {
  type?: string;
  challenge?: string;
  event_id?: string;
  event?: {
    type?: string;
    user?: string;
    channel?: string;
    ts?: string;
  };
  team_id?: string;
}

export interface SlackLifecycleNotificationOptions {
  retryEligible?: boolean;
  serviceBaseUrl?: string;
}

export interface SlackNotifier {
  postLifecycleNotification(
    runSummary: RunRecord,
    state: RunLifecycleState,
    options?: SlackLifecycleNotificationOptions
  ): Promise<{ ok: true }>;
}
