import { describe, expect, it, vi } from 'vitest';

import { registerSlackEvents } from './slack-events.ts';

type MissionHandler = (payload: {
  ack?: () => Promise<void>;
  command?: Record<string, unknown>;
  respond?: (response: { response_type: 'ephemeral'; text: string }) => Promise<void>;
}) => Promise<void>;

describe('slack adapter events', () => {
  it('T-S84-E1 registers /mission and routes text through router with ack/respond', async () => {
    let handler: MissionHandler | null = null;
    const router = {
      routeMissionText: vi.fn(async () => ({ ok: true as const, text: 'Mission started\n\nmission: m1\nrunId: run_1' })),
      helpText: 'help'
    };

    const registration = registerSlackEvents({
      app: {
        command: (name, registered) => {
          expect(name).toBe('/mission');
          handler = registered;
        }
      },
      router
    });

    expect(registration.commandsRegistered).toBe(1);
    expect(handler).not.toBeNull();

    const ack = vi.fn(async () => undefined);
    const respond = vi.fn(async () => undefined);
    await handler?.({
      ack,
      command: { text: 'run m1' },
      respond
    });

    expect(ack).toHaveBeenCalledTimes(1);
    expect(router.routeMissionText).toHaveBeenCalledWith('run m1');
    expect(respond).toHaveBeenCalledWith({
      response_type: 'ephemeral',
      text: 'Mission started\n\nmission: m1\nrunId: run_1'
    });
  });
});
