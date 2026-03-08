import type { SlackClient } from './slack-client.ts';
import type { SlackRouter } from './slack-router.ts';

function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function errorBlocks(message: string): Array<Record<string, unknown>> {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error*\n${message}`
      }
    }
  ];
}

export function registerSlackEvents(input: {
  app: {
    command: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
    action: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
    message: (pattern: RegExp, handler: (args: Record<string, unknown>) => Promise<void>) => void;
  };
  router: SlackRouter;
  client: SlackClient;
}) {
  async function handleCommand(command: '/mission' | '/artifact', payload: Record<string, unknown>): Promise<void> {
    const ack = payload.ack;
    if (typeof ack === 'function') {
      await (ack as () => Promise<void>)();
    }

    const commandPayload = (payload.command && typeof payload.command === 'object')
      ? payload.command as Record<string, unknown>
      : {};

    const text = typeof commandPayload.text === 'string' ? commandPayload.text : '';
    const args = tokenize(text);
    const routeResult = await input.router.handleCommand(command, args);

    const user = typeof commandPayload.user_id === 'string' ? commandPayload.user_id : '';
    const channel = typeof commandPayload.channel_id === 'string' ? commandPayload.channel_id : '';

    if (!channel || !user) {
      return;
    }

    if (!routeResult.ok) {
      await input.client.postEphemeral(user, channel, errorBlocks(`${routeResult.error.code}: ${routeResult.error.message}`));
      return;
    }

    await input.client.postEphemeral(user, channel, routeResult.message.blocks);

    if (command === '/artifact' && Array.isArray(routeResult.artifacts)) {
      for (const filePath of routeResult.artifacts) {
        await input.client.uploadFile(channel, filePath);
      }
    }
  }

  input.app.command('/mission', async (payload) => {
    await handleCommand('/mission', payload);
  });

  input.app.command('/artifact', async (payload) => {
    await handleCommand('/artifact', payload);
  });

  input.app.action('mission_refresh', async (payload) => {
    const ack = payload.ack;
    if (typeof ack === 'function') {
      await (ack as () => Promise<void>)();
    }
  });

  input.app.message(/^mission\s+help$/i, async () => {
    // Message actions are intentionally no-op; slash commands remain the control surface.
  });
}
