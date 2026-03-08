import { createMissionService } from '../../control-plane/operator/mission-service.ts';
import { createMissionController } from '../mission/mission-controller.ts';
import { createSlackClient } from './slack-client.ts';
import { registerSlackEvents } from './slack-events.ts';
import { createSlackRouter } from './slack-router.ts';

export let slackApp: unknown;

export async function startSlackGateway(): Promise<unknown> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!botToken || !signingSecret || !appToken) {
    throw new Error('SLACK_CONFIG_MISSING: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_APP_TOKEN are required');
  }

  let boltModule: { App: new (options: Record<string, unknown>) => Record<string, unknown> };
  try {
    const loaded = await import('@slack/bolt');
    boltModule = loaded as unknown as { App: new (options: Record<string, unknown>) => Record<string, unknown> };
  } catch {
    throw new Error('SLACK_BOLT_UNAVAILABLE: install @slack/bolt to start Slack gateway');
  }

  const app = new boltModule.App({
    token: botToken,
    signingSecret,
    appToken,
    socketMode: true
  }) as Record<string, unknown>;

  const missionService = createMissionService();
  const missionController = createMissionController({ missionService });
  const slackRouter = createSlackRouter(missionController, {
    listMissions: () => missionService.listMissions()
  });

  const client = createSlackClient((app.client ?? {}) as Parameters<typeof createSlackClient>[0]);

  registerSlackEvents({
    app: app as Parameters<typeof registerSlackEvents>[0]['app'],
    router: slackRouter,
    client
  });

  const start = app.start;
  if (typeof start !== 'function') {
    throw new Error('SLACK_GATEWAY_INVALID_APP: missing start()');
  }

  await (start as () => Promise<void>)();
  slackApp = app;
  return app;
}
