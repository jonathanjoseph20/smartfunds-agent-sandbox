import { describe, expect, it } from 'vitest';

import {
  assertSlackGatewayReadiness,
  SlackStartupError,
  validateSlackStartupConfig
} from '../slack-config.ts';

describe('slack startup config', () => {
  it('T-S81-CFG1 fails fast for missing required env', () => {
    expect(() => validateSlackStartupConfig({})).toThrowError(SlackStartupError);
    expect(() => validateSlackStartupConfig({ SLACK_BOT_TOKEN: 'x', SLACK_SIGNING_SECRET: 'y' })).toThrow(
      'SLACK_APP_TOKEN'
    );
  });

  it('T-S81-CFG2 validates complete socket mode config and readiness', () => {
    const config = validateSlackStartupConfig({
      SLACK_BOT_TOKEN: 'xoxb-test',
      SLACK_SIGNING_SECRET: 'secret',
      SLACK_APP_TOKEN: 'xapp-test',
      SLACK_SOCKET_MODE: 'true'
    });

    expect(config.socketMode).toBe(true);
    expect(() => assertSlackGatewayReadiness({ socketModeConnected: true, commandsRegistered: 2 })).not.toThrow();
  });
});
