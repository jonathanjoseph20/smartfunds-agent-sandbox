import { describe, expect, it, vi } from 'vitest';

import { createSlackApp, initializeSlackClient, validateSlackEnvironment } from './slack-client.ts';

describe('slack adapter client', () => {
  it('T-S84-C1 fails deterministically when Slack env vars are missing', () => {
    expect(() => validateSlackEnvironment({})).toThrow(
      'SLACK_CONFIG_MISSING: SLACK_APP_TOKEN, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET'
    );
  });

  it('T-S84-C2 fails deterministically when @slack/bolt is unavailable', async () => {
    await expect(createSlackApp({
      config: {
        botToken: 'xoxb-test',
        signingSecret: 'secret',
        appToken: 'xapp-test'
      },
      loadBolt: async () => {
        throw new Error('module-not-found');
      }
    })).rejects.toThrow('SLACK_BOLT_UNAVAILABLE: install @slack/bolt to start Slack mission adapter');
  });

  it('T-S84-C3 initializes app and registers command handlers explicitly', async () => {
    const command = vi.fn<(name: string, handler: (payload: {
      ack?: () => Promise<void>;
      command?: Record<string, unknown>;
      respond?: (response: { response_type: 'ephemeral'; text: string }) => Promise<void>;
    }) => Promise<void>) => void>();
    const start = vi.fn(async () => undefined);
    const postMessage = vi.fn(async () => undefined);

    const client = await initializeSlackClient({
      env: {
        SLACK_BOT_TOKEN: 'xoxb-test',
        SLACK_SIGNING_SECRET: 'secret',
        SLACK_APP_TOKEN: 'xapp-test'
      },
      router: {
        helpText: 'help',
        routeMissionText: vi.fn(async () => ({ ok: true as const, text: 'ok' }))
      },
      loadBolt: async () => ({
        App: class {
          command = command;
          start = start;
          client = {
            chat: {
              postMessage
            }
          };
        }
      })
    });

    expect(client.commandsRegistered).toBe(1);

    await client.start();
    expect(start).toHaveBeenCalledTimes(1);

    await client.sendMessage({ channel: 'C1', text: 'hello' });
    expect(postMessage).toHaveBeenCalledWith({ channel: 'C1', text: 'hello' });
  });
});
