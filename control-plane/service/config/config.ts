import { parseRuntimeServiceConfig, type RuntimeServiceConfig } from './schema.ts';

const REQUIRED_DEFAULTS: Record<string, string> = {
  SMARTFUNDS_RUNTIME_PORT: '3100',
  SMARTFUNDS_ENV: 'development',
  SMARTFUNDS_LOG_LEVEL: 'info',
  SMARTFUNDS_COCKPIT_PORT: '5173',
  SMARTFUNDS_RUNTIME_BASE_URL: 'http://127.0.0.1:3100',
  SMARTFUNDS_DATA_DIR: './.smartfunds-data',
  SMARTFUNDS_CONFIG_DIR: './control-plane'
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeServiceConfig {
  const merged = {
    ...REQUIRED_DEFAULTS,
    ...env
  };

  return parseRuntimeServiceConfig(merged);
}
