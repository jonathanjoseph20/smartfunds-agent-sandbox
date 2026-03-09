import { registerSlackEvents } from './slack-events.ts';
import type { SlackRouter } from './slack-router.ts';

export type SlackEnvironmentConfig = {
  botToken: string;
  signingSecret: string;
  appToken: string;
};

type BoltApp = {
  command: (
    name: string,
    handler: (payload: {
      ack?: () => Promise<void>;
      command?: Record<string, unknown>;
      respond?: (response: { response_type: 'ephemeral'; text: string }) => Promise<void>;
    }) => Promise<void>
  ) => void;
  start: () => Promise<void>;
  client: {
    chat: {
      postMessage: (input: { channel: string; text: string }) => Promise<unknown>;
    };
  };
};

type BoltModule = {
  App: new (input: {
    token: string;
    signingSecret: string;
    appToken: string;
    socketMode: true;
  }) => BoltApp;
};

export function validateSlackEnvironment(env: NodeJS.ProcessEnv = process.env): SlackEnvironmentConfig {
  const botToken = env.SLACK_BOT_TOKEN?.trim() ?? '';
  const signingSecret = env.SLACK_SIGNING_SECRET?.trim() ?? '';
  const appToken = env.SLACK_APP_TOKEN?.trim() ?? '';

  const missing: string[] = [];
  if (botToken.length === 0) {
    missing.push('SLACK_BOT_TOKEN');
  }
  if (signingSecret.length === 0) {
    missing.push('SLACK_SIGNING_SECRET');
  }
  if (appToken.length === 0) {
    missing.push('SLACK_APP_TOKEN');
  }

  if (missing.length > 0) {
    throw new Error(`SLACK_CONFIG_MISSING: ${missing.sort((left, right) => left.localeCompare(right)).join(', ')}`);
  }

  return {
    botToken,
    signingSecret,
    appToken
  };
}

async function defaultLoadBolt(): Promise<BoltModule> {
  return import('@slack/bolt') as Promise<BoltModule>;
}

export async function createSlackApp(input: {
  config: SlackEnvironmentConfig;
  loadBolt?: () => Promise<BoltModule>;
}): Promise<BoltApp> {
  const loadBolt = input.loadBolt ?? defaultLoadBolt;

  let boltModule: BoltModule;
  try {
    boltModule = await loadBolt();
  } catch {
    throw new Error('SLACK_BOLT_UNAVAILABLE: install @slack/bolt to start Slack mission adapter');
  }

  return new boltModule.App({
    token: input.config.botToken,
    signingSecret: input.config.signingSecret,
    appToken: input.config.appToken,
    socketMode: true
  });
}

export async function initializeSlackClient(input: {
  router: SlackRouter;
  env?: NodeJS.ProcessEnv;
  loadBolt?: () => Promise<BoltModule>;
}) {
  const config = validateSlackEnvironment(input.env);
  const app = await createSlackApp({
    config,
    loadBolt: input.loadBolt
  });

  const registration = registerSlackEvents({
    app,
    router: input.router
  });

  async function start(): Promise<void> {
    await app.start();
  }

  async function sendMessage(message: { channel: string; text: string }): Promise<void> {
    await app.client.chat.postMessage(message);
  }

  return {
    config,
    app,
    commandsRegistered: registration.commandsRegistered,
    start,
    sendMessage
  };
}

export type SlackClient = Awaited<ReturnType<typeof initializeSlackClient>>;
