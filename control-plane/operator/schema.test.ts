import { describe, expect, it } from 'vitest';

import { parseOperatorCommand } from './schema.ts';

describe('operator schema parser', () => {
  it('T-OPV1 parses mission:start with deterministic params', () => {
    const parsed = parseOperatorCommand(['mission:start', 'rwa-market-analysis', '--market', 'ethereum', '--horizon=30d']);

    expect(parsed).toEqual({
      name: 'mission:start',
      missionId: 'rwa-market-analysis',
      params: {
        horizon: '30d',
        market: 'ethereum'
      }
    });
  });

  it('T-OPV2 rejects unknown command deterministically', () => {
    expect(() => parseOperatorCommand(['nope'])).toThrow(/Unknown command: nope/);
  });

  it('T-OPV3 rejects missing required args', () => {
    expect(() => parseOperatorCommand(['workflow:resume'])).toThrow(/Missing required --run/);
  });

  it('T-OPV4 rejects invalid option combinations', () => {
    expect(() => parseOperatorCommand(['workflow:list', '--run', 'run_1'])).toThrow(/does not accept arguments/);
  });
});
