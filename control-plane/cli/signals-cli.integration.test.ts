import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './signals-history.ts';
import { main as inspectMain } from './signals-inspect.ts';
import { main as listMain } from './signals-list.ts';

let originalCwd = '';
let tmpDir = '';

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signals-cli-int-'));
  process.chdir(tmpDir);

  fs.mkdirSync(path.join('signals', '2026-03-10'), { recursive: true });
  fs.writeFileSync(path.join('signals', '2026-03-10', 'signal-log.json'), `${canonicalStringify([
    {
      signalType: 'tvl_spike',
      sourceMission: 'liquidity-scan',
      dataset: 'protocol_tvl_timeseries',
      metadata: { protocol: 'Aave', tvlChangePercent: 12 },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'k1',
      logDate: '2026-03-10'
    }
  ])}\n`, 'utf8');
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('signals CLI integration', () => {
  it('T-SIG-CLI-INT1 signals:list reads persisted logs', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('tvl_spike');
    stdout.mockRestore();
  });

  it('T-SIG-CLI-INT2 signals:inspect filters by type', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['tvl_spike']);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('protocol_tvl_timeseries');
    stdout.mockRestore();
  });

  it('T-SIG-CLI-INT3 signals:history groups by date', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain([]);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('2026-03-10');
    stdout.mockRestore();
  });
});
