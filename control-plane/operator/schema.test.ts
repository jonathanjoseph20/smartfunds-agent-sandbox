import { describe, expect, it } from 'vitest';

import { parseOperatorCommand } from './schema.ts';

describe('operator schema parser', () => {
  it('T-S77-P1 parses mission create alias', () => {
    const parsed = parseOperatorCommand(['mission', 'create', 'tokenization-legal-analysis']);
    expect(parsed).toEqual({
      name: 'mission:create',
      templateId: 'tokenization-legal-analysis'
    });
  });

  it('T-S77-P2 parses mission list alias', () => {
    const parsed = parseOperatorCommand(['mission', 'list']);
    expect(parsed).toEqual({
      name: 'mission:runtime-list'
    });
  });

  it('T-S77-P3 parses mission run alias', () => {
    const parsed = parseOperatorCommand(['mission', 'run', 'mission-001']);
    expect(parsed).toEqual({
      name: 'mission:run',
      missionId: 'mission-001'
    });
  });

  it('T-S77-P4 parses mission status alias', () => {
    const parsed = parseOperatorCommand(['mission', 'status', 'mission-001']);
    expect(parsed).toEqual({
      name: 'mission:status',
      missionId: 'mission-001'
    });
  });

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

  it('T-S77-P5 preserves backward compatibility for mission:list', () => {
    const parsed = parseOperatorCommand(['mission:list']);
    expect(parsed).toEqual({ name: 'mission:list' });
  });
});
