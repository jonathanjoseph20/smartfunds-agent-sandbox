import { describe, expect, it, vi } from 'vitest';

import { registerSlackEvents } from '../slack-events.ts';

type Handler = (payload: Record<string, unknown>) => Promise<void>;

function buildAppHarness() {
  const commandHandlers = new Map<string, Handler>();
  const actionHandlers = new Map<string, Handler>();

  return {
    app: {
      command: (name: string, handler: Handler) => {
        commandHandlers.set(name, handler);
      },
      action: (name: string, handler: Handler) => {
        actionHandlers.set(name, handler);
      },
      message: vi.fn()
    },
    commandHandlers,
    actionHandlers
  };
}

describe('slack events', () => {
  it('T-S81-E1 registers command handlers and serves /artifact without eager upload', async () => {
    const harness = buildAppHarness();
    const postEphemeral = vi.fn(async () => undefined);
    const uploadFile = vi.fn(async () => undefined);
    const router = {
      handleCommand: vi.fn(async () => ({
        ok: true as const,
        message: {
          text: 'Artifacts for m1',
          blocks: [{ type: 'section' }]
        },
        artifacts: ['artifacts/m1/companies.csv']
      }))
    };

    const registration = registerSlackEvents({
      app: harness.app,
      router,
      client: {
        postMessage: vi.fn(async () => undefined),
        postEphemeral,
        uploadFile
      }
    });

    expect(registration.commandsRegistered).toBe(2);

    const handler = harness.commandHandlers.get('/artifact');
    expect(handler).toBeDefined();
    await handler?.({
      ack: async () => undefined,
      command: {
        text: 'm1',
        user_id: 'U1',
        channel_id: 'C1'
      }
    });

    expect(postEphemeral).toHaveBeenCalledTimes(1);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('T-S81-E2 handles artifact_get action upload success and failure deterministically', async () => {
    const harness = buildAppHarness();
    const postEphemeral = vi.fn(async () => undefined);
    const uploadFile = vi
      .fn(async () => undefined)
      .mockRejectedValueOnce(new Error('SLACK_UPLOAD_FAILED: rate_limited'));

    registerSlackEvents({
      app: harness.app,
      router: {
        handleCommand: vi.fn()
      },
      client: {
        postMessage: vi.fn(async () => undefined),
        postEphemeral,
        uploadFile
      }
    });

    const handler = harness.actionHandlers.get('artifact_get');
    expect(handler).toBeDefined();

    await handler?.({
      ack: async () => undefined,
      body: {
        user: { id: 'U1' },
        channel: { id: 'C1' },
        actions: [{ value: 'artifacts/m1/companies.csv' }]
      }
    });

    await handler?.({
      ack: async () => undefined,
      body: {
        user: { id: 'U1' },
        channel: { id: 'C1' },
        actions: [{ value: 'artifacts/m1/companies.csv' }]
      }
    });

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(postEphemeral).toHaveBeenCalledTimes(2);
    const responses = postEphemeral.mock.calls.map((call) => JSON.stringify(call[2]));
    expect(responses.some((value) => value.includes('ARTIFACT_UPLOAD_FAILED'))).toBe(true);
  });
});
