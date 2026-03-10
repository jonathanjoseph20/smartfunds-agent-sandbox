import { describe, expect, it, vi } from 'vitest';

import { main } from './mission-build.ts';

const runMissionMain = vi.fn();

vi.mock('./mission-run.ts', () => ({
  main: (...args: unknown[]) => runMissionMain(...args)
}));

describe('mission-build CLI', () => {
  it('T-SPC-CL1 forwards args with --profile build', async () => {
    runMissionMain.mockResolvedValueOnce(0);
    const code = await main(['--mission', 'dashboard-copy-refresh']);
    expect(code).toBe(0);
    expect(runMissionMain).toHaveBeenCalledWith(['--profile', 'build', '--mission', 'dashboard-copy-refresh']);
  });
});
