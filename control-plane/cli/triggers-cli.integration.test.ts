import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './triggers-history.ts';
import { main as inspectMain } from './triggers-inspect.ts';
import { main as listMain } from './triggers-list.ts';

let originalCwd = '';
let tmpDir = '';

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'triggers-cli-int-'));
  process.chdir(tmpDir);

  fs.mkdirSync(path.join('control-plane', 'triggers', 'definitions'), { recursive: true });
  fs.writeFileSync(path.join('control-plane', 'triggers', 'definitions', 'liquidity-drain-investigation.json'), `${canonicalStringify({
    triggerId: 'liquidity-drain-investigation',
    signalType: 'liquidity_drain',
    mission: 'defi-liquidity-scan',
    cooldownSlots: 1
  })}\n`, 'utf8');

  fs.mkdirSync(path.join('triggers', '2026-03-10'), { recursive: true });
  fs.writeFileSync(path.join('triggers', '2026-03-10', 'trigger-log.json'), `${canonicalStringify([
    {
      triggerId: 'liquidity-drain-investigation',
      signalReference: 'signal-key-1',
      missionLaunched: 'defi-liquidity-scan',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    }
  ])}\n`, 'utf8');
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('triggers CLI integration', () => {
  it('T-TRIG-CLI-INT1 triggers:list loads persisted definitions', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('liquidity-drain-investigation');
    stdout.mockRestore();
  });

  it('T-TRIG-CLI-INT2 triggers:inspect returns definition by id', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['liquidity-drain-investigation']);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('defi-liquidity-scan');
    stdout.mockRestore();
  });

  it('T-TRIG-CLI-INT3 triggers:history returns grouped trigger logs', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain([]);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('2026-03-10');
    stdout.mockRestore();
  });
});
