import { describe, expect, it } from 'vitest';

import { parseArgs } from './governance-validate-local.ts';

describe('governance:validate:local arg parsing', () => {
  it('T-L1 parses full mode and pr number', () => {
    expect(parseArgs(['--mode', 'full', '--pr', '70'])).toEqual({
      mode: 'full',
      pr: 70
    });
  });

  it('T-L1 requires pr', () => {
    expect(() => parseArgs(['--mode', 'full'])).toThrow('Missing required --pr argument.');
  });
});
