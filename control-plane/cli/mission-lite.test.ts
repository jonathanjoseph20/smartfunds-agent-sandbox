import { describe, expect, it, vi } from 'vitest';

import { main } from './mission-lite.ts';

const runMissionMain = vi.fn();

vi.mock('./mission-run.ts', () => ({
  main: (...args: unknown[]) => runMissionMain(...args)
}));

describe('mission-lite CLI', () => {
  it('T-SPB-CL1 forwards args with --profile lite', async () => {
    runMissionMain.mockResolvedValueOnce(0);
    const code = await main(['--mission', 'research-market-scan']);
    expect(code).toBe(0);
    expect(runMissionMain).toHaveBeenCalledWith(['--profile', 'lite', '--mission', 'research-market-scan']);
  });
});

