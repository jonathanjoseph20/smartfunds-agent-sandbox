import type { SlackRouter } from './slack-router.ts';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function registerSlackEvents(input: {
  app: {
    command: (
      name: string,
      handler: (payload: {
        ack?: () => Promise<void>;
        command?: Record<string, unknown>;
        respond?: (response: { response_type: 'ephemeral'; text: string }) => Promise<void>;
      }) => Promise<void>
    ) => void;
  };
  router: SlackRouter;
}) {
  input.app.command('/mission', async (payload) => {
    if (payload.ack) {
      await payload.ack();
    }

    const command = asRecord(payload.command);
    const text = typeof command.text === 'string' ? command.text : '';
    const routed = await input.router.routeMissionText(text);

    if (payload.respond) {
      await payload.respond({
        response_type: 'ephemeral',
        text: routed.text
      });
    }
  });

  return {
    commandsRegistered: 1
  };
}
