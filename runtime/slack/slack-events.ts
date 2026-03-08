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

function successBlocks(message: string): Array<Record<string, unknown>> {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message
      }
    }
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveActionContext(payload: Record<string, unknown>): {
  userId: string;
  channelId: string;
  actionValue: string | null;
} {
  const body = asRecord(payload.body);
  const actions = Array.isArray(body.actions) ? body.actions : [];
  const firstAction = actions.length > 0 ? asRecord(actions[0]) : {};
  const user = asRecord(body.user);
  const channel = asRecord(body.channel);

  return {
    userId: typeof user.id === 'string' ? user.id : '',
    channelId: typeof channel.id === 'string' ? channel.id : '',
    actionValue: typeof firstAction.value === 'string' && firstAction.value.trim().length > 0 ? firstAction.value : null
  };
}

export function registerSlackEvents(input: {
  app: {
    command: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
    action: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
    message: (pattern: RegExp, handler: (args: Record<string, unknown>) => Promise<void>) => void;
  };
  router: SlackRouter;
  client: SlackClient;
}) : { commandsRegistered: number } {
  let commandsRegistered = 0;

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

  }

  input.app.command('/mission', async (payload) => {
    await handleCommand('/mission', payload);
  });
  commandsRegistered += 1;

  input.app.command('/artifact', async (payload) => {
    await handleCommand('/artifact', payload);
  });
  commandsRegistered += 1;

  input.app.action('mission_refresh', async (payload) => {
    const ack = payload.ack;
    if (typeof ack === 'function') {
      await (ack as () => Promise<void>)();
    }
  });

  input.app.action('artifact_get', async (payload) => {
    const ack = payload.ack;
    if (typeof ack === 'function') {
      await (ack as () => Promise<void>)();
    }

    const context = resolveActionContext(payload);
    if (!context.userId || !context.channelId || !context.actionValue) {
      return;
    }

    try {
      await input.client.uploadFile(context.channelId, context.actionValue);
      await input.client.postEphemeral(
        context.userId,
        context.channelId,
        successBlocks(`Artifact uploaded: ${context.actionValue}`)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'artifact_upload_failed';
      await input.client.postEphemeral(
        context.userId,
        context.channelId,
        errorBlocks(`ARTIFACT_UPLOAD_FAILED: ${message}`)
      );
    }
  });

  input.app.message(/^mission\s+help$/i, async () => {
    // Message actions are intentionally no-op; slash commands remain the control surface.
  });

  return {
    commandsRegistered
  };
}
