export class SlackStartupError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type SlackStartupConfig = {
  botToken: string;
  signingSecret: string;
  appToken: string | null;
  socketMode: boolean;
};

function resolveRequiredSecret(
  env: NodeJS.ProcessEnv,
  key: 'SLACK_BOT_TOKEN' | 'SLACK_SIGNING_SECRET' | 'SLACK_APP_TOKEN'
): string | null {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

export function validateSlackStartupConfig(env: NodeJS.ProcessEnv = process.env): SlackStartupConfig {
  const socketMode = (env.SLACK_SOCKET_MODE ?? 'true').trim().toLowerCase() !== 'false';
  const botToken = resolveRequiredSecret(env, 'SLACK_BOT_TOKEN');
  const signingSecret = resolveRequiredSecret(env, 'SLACK_SIGNING_SECRET');
  const appToken = resolveRequiredSecret(env, 'SLACK_APP_TOKEN');

  const missing: string[] = [];
  if (!botToken) {
    missing.push('SLACK_BOT_TOKEN');
  }
  if (!signingSecret) {
    missing.push('SLACK_SIGNING_SECRET');
  }
  if (socketMode && !appToken) {
    missing.push('SLACK_APP_TOKEN');
  }

  if (missing.length > 0) {
    throw new SlackStartupError(
      'SLACK_CONFIG_MISSING',
      `Missing Slack configuration: ${missing.sort((a, b) => a.localeCompare(b)).join(', ')}`
    );
  }

  return {
    botToken: botToken as string,
    signingSecret: signingSecret as string,
    appToken,
    socketMode
  };
}

export function assertSlackGatewayReadiness(input: {
  socketModeConnected: boolean;
  commandsRegistered: number;
}): void {
  if (!input.socketModeConnected) {
    throw new SlackStartupError('SLACK_SOCKET_MODE_NOT_READY', 'Slack Socket Mode connection was not established.');
  }
  if (input.commandsRegistered <= 0) {
    throw new SlackStartupError('SLACK_COMMANDS_NOT_REGISTERED', 'No Slack command handlers were registered.');
  }
}
