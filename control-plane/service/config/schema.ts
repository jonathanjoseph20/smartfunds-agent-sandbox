export interface RuntimeServiceConfig {
  runtimePort: number;
  env: 'development' | 'test' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  runtimeBaseUrl: string;
  cockpitPort: number;
  corsOrigin: string;
  slackBotToken: string | null;
  slackSigningSecret: string | null;
  dataDir: string;
  configDir: string;
}

function parsePort(name: string, value: string | undefined): number {
  if (!value || value.trim().length === 0) {
    throw new Error(`CONFIG_INVALID: ${name} is required`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`CONFIG_INVALID: ${name} must be a valid port`);
  }

  return parsed;
}

function parseEnum<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[]
): T {
  if (!value || value.trim().length === 0) {
    throw new Error(`CONFIG_INVALID: ${name} is required`);
  }

  if (!allowed.includes(value as T)) {
    throw new Error(`CONFIG_INVALID: ${name} must be one of ${allowed.join(',')}`);
  }

  return value as T;
}

function parseUrl(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`CONFIG_INVALID: ${name} is required`);
  }

  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`CONFIG_INVALID: ${name} must be a valid URL`);
  }
}

function parsePath(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`CONFIG_INVALID: ${name} is required`);
  }

  return value.trim();
}

export function parseRuntimeServiceConfig(env: NodeJS.ProcessEnv): RuntimeServiceConfig {
  const runtimePort = parsePort('SMARTFUNDS_RUNTIME_PORT', env.SMARTFUNDS_RUNTIME_PORT);
  const envName = parseEnum('SMARTFUNDS_ENV', env.SMARTFUNDS_ENV, ['development', 'test', 'production'] as const);
  const logLevel = parseEnum('SMARTFUNDS_LOG_LEVEL', env.SMARTFUNDS_LOG_LEVEL, ['debug', 'info', 'warn', 'error'] as const);
  const cockpitPort = parsePort('SMARTFUNDS_COCKPIT_PORT', env.SMARTFUNDS_COCKPIT_PORT);
  const runtimeBaseUrl = parseUrl('SMARTFUNDS_RUNTIME_BASE_URL', env.SMARTFUNDS_RUNTIME_BASE_URL);
  const corsOrigin = parseUrl('SMARTFUNDS_CORS_ORIGIN', env.SMARTFUNDS_CORS_ORIGIN ?? `http://127.0.0.1:${String(cockpitPort)}`);
  const dataDir = parsePath('SMARTFUNDS_DATA_DIR', env.SMARTFUNDS_DATA_DIR);
  const configDir = parsePath('SMARTFUNDS_CONFIG_DIR', env.SMARTFUNDS_CONFIG_DIR);

  return {
    runtimePort,
    env: envName,
    logLevel,
    runtimeBaseUrl,
    cockpitPort,
    corsOrigin,
    slackBotToken: env.SLACK_BOT_TOKEN?.trim() ? env.SLACK_BOT_TOKEN : null,
    slackSigningSecret: env.SLACK_SIGNING_SECRET?.trim() ? env.SLACK_SIGNING_SECRET : null,
    dataDir,
    configDir
  };
}
