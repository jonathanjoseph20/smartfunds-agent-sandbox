import { describe, expect, it, vi } from 'vitest';

import { parseArgs, runGovernancePrBody } from './governance-pr-body.ts';

describe('governance:pr-body', () => {
  it('validates required arguments and tier enum', () => {
    expect(() => parseArgs([])).toThrow('Missing required --pr <n> argument.');
    expect(() => parseArgs(['--pr', '7'])).toThrow(
      'Missing required --tier tier-0|tier-1|tier-2|tier-3 argument.'
    );
    expect(() => parseArgs(['--pr', '7', '--tier', 'tier-5'])).toThrow('Invalid tier: tier-5');
  });

  it('fails when gh readback body is missing required tier/evidence fence', async () => {
    const execFileSyncImpl = vi.fn((command: string, args: string[]) => {
      if (command !== 'gh') {
        throw new Error('Unexpected command');
      }
      if (args[0] === 'pr' && args[1] === 'edit') {
        return '';
      }
      if (args[0] === 'pr' && args[1] === 'view') {
        expect(args).toContain('--jq');
        return 'tier-3\n\n```\nmissing evidence marker\n```\n';
      }
      throw new Error(`Unexpected gh args: ${args.join(' ')}`);
    });

    const writeFileSyncImpl = vi.fn();

    await expect(
      runGovernancePrBody(['--pr', '73', '--tier', 'tier-3'], {
        execFileSyncImpl: execFileSyncImpl as unknown as typeof import('node:child_process').execFileSync,
        writeFileSyncImpl: writeFileSyncImpl as unknown as typeof import('node:fs').writeFileSync
      })
    ).rejects.toThrow('Missing evidence fence. Add a line exactly: ```evidence');
  });
});
