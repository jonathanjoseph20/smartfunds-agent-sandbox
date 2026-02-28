import { afterEach, describe, expect, it, vi } from 'vitest';

import { main, parseArgs } from './swarm-task.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('swarm-task CLI args', () => {
  it('--help exits 0 and prints usage', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnTaskFn = vi.fn();

    const code = await main(['--help'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(spawnTaskFn).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      'Usage: npm run swarm:task -- [--execution-mode structured|autonomous] [--dry-run] [--help]\n'
    );
  });

  it('--dry-run exits 0 and does not invoke PR/CI execution', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnTaskFn = vi.fn();

    const code = await main(['--dry-run', '--execution-mode=autonomous'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(spawnTaskFn).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      '{"executionMode":"autonomous","mode":"dry-run","steps":["Validate CLI inputs","Compute deterministic task plan","Skip PR open/edit operations","Skip CI polling","Skip retry mutation"]}\n'
    );
  });

  it('unknown arg returns deterministic error message', () => {
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument: --unknown');
  });
});
