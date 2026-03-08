import { createMissionService } from '../../control-plane/operator/mission-service.ts';
import { createMissionController } from '../mission/mission-controller.ts';
import { createSlackClient } from './slack-client.ts';
import { assertSlackGatewayReadiness, validateSlackStartupConfig } from './slack-config.ts';
import { registerSlackEvents } from './slack-events.ts';
import { createSlackRouter } from './slack-router.ts';

export let slackApp: unknown;

export async function startSlackGateway(): Promise<unknown> {
  const config = validateSlackStartupConfig(process.env);

  let boltModule: { App: new (options: Record<string, unknown>) => Record<string, unknown> };
  try {
    const loaded = await import('@slack/bolt');
    boltModule = loaded as unknown as { App: new (options: Record<string, unknown>) => Record<string, unknown> };
  } catch {
    throw new Error('SLACK_BOLT_UNAVAILABLE: install @slack/bolt to start Slack gateway');
  }

  const app = new boltModule.App({
    token: config.botToken,
    signingSecret: config.signingSecret,
    appToken: config.appToken,
    socketMode: config.socketMode
  }) as Record<string, unknown>;

  const missionService = createMissionService();
  const missionController = createMissionController({ missionService });
  const slackRouter = createSlackRouter(missionController, {
    listMissions: () => missionService.listMissions()
  });

  const client = createSlackClient((app.client ?? {}) as Parameters<typeof createSlackClient>[0]);

  const registration = registerSlackEvents({
    app: app as Parameters<typeof registerSlackEvents>[0]['app'],
    router: slackRouter,
    client
  });

  const start = app.start;
  if (typeof start !== 'function') {
    throw new Error('SLACK_GATEWAY_INVALID_APP: missing start()');
  }

  await (start as () => Promise<void>)();
  console.log('[Slack] Connected via Socket Mode');
  assertSlackGatewayReadiness({
    socketModeConnected: true,
    commandsRegistered: registration.commandsRegistered
  });
  console.log('[Slack] Commands registered');
  console.log('[Slack] Gateway ready');

  slackApp = app;
  return app;
}
