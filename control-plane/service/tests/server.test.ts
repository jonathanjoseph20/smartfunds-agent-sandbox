import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config/config.ts';
import { parseRuntimeServiceConfig } from '../config/schema.ts';

describe('runtime service config', () => {
  it('T-S74-CFG1 fails when required environment values are missing', () => {
    expect(() => parseRuntimeServiceConfig({})).toThrowError('CONFIG_INVALID: SMARTFUNDS_RUNTIME_PORT is required');
  });

  it('T-S74-CFG2 fails when runtime port is invalid', () => {
    expect(() => parseRuntimeServiceConfig({
      SMARTFUNDS_RUNTIME_PORT: '0',
      SMARTFUNDS_ENV: 'development',
      SMARTFUNDS_LOG_LEVEL: 'info',
      SMARTFUNDS_RUNTIME_BASE_URL: 'http://127.0.0.1:3100',
      SMARTFUNDS_COCKPIT_PORT: '5173',
      SMARTFUNDS_DATA_DIR: './data',
      SMARTFUNDS_CONFIG_DIR: './control-plane'
    })).toThrowError('CONFIG_INVALID: SMARTFUNDS_RUNTIME_PORT must be a valid port');
  });

  it('T-S74-CFG3 applies deterministic defaults through loadConfig', () => {
    const config = loadConfig({
      SMARTFUNDS_RUNTIME_PORT: '3100',
      SMARTFUNDS_ENV: 'development',
      SMARTFUNDS_LOG_LEVEL: 'info',
      SMARTFUNDS_RUNTIME_BASE_URL: 'http://127.0.0.1:3100',
      SMARTFUNDS_COCKPIT_PORT: '5173',
      SMARTFUNDS_DATA_DIR: './data',
      SMARTFUNDS_CONFIG_DIR: './control-plane'
    });

    expect(config.corsOrigin).toBe('http://127.0.0.1:5173');
  });
});
