import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { main as inspectMain } from '../../../cli/mission-templates-inspect.ts';
import { main as instantiateMain } from '../../../cli/mission-templates-instantiate.ts';
import { main as listMain } from '../../../cli/mission-templates-list.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-template-cli');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function captureStdout(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
}

function getPrintedJson(stdout: ReturnType<typeof vi.spyOn>): unknown {
  const joined = stdout.mock.calls.map((call) => String(call[0])).join('');
  return JSON.parse(joined) as unknown;
}

describe('mission template CLI integration', () => {
  it('T-MTPL-C1 mission-templates:list outputs expected summaries', async () => {
    const stdout = captureStdout();

    const code = await listMain([]);

    expect(code).toBe(0);
    const payload = getPrintedJson(stdout) as Array<Record<string, string>>;
    expect(payload.length).toBeGreaterThan(0);
    expect(payload.find((entry) => entry.templateId === 'evaluate-startup-opportunity')).toMatchObject({
      templateId: 'evaluate-startup-opportunity',
      displayName: 'Evaluate Startup Opportunity',
    });

    const templateIds = payload.map((entry) => entry.templateId);
    expect(templateIds).toEqual([...templateIds].sort((left, right) => left.localeCompare(right)));

    stdout.mockRestore();
  });

  it('T-MTPL-C2 mission-templates:inspect returns normalized template', async () => {
    const stdout = captureStdout();

    const code = await inspectMain(['--template', 'evaluate-startup-opportunity']);

    expect(code).toBe(0);
    const payload = getPrintedJson(stdout) as Record<string, unknown>;
    expect(payload.templateId).toBe('evaluate-startup-opportunity');
    expect(Array.isArray(payload.defaultDeliverablesTemplate)).toBe(true);
    stdout.mockRestore();
  });

  it('T-MTPL-C3 mission-templates:instantiate returns normalized mission payload and instance', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const paramsFile = path.join(tmpRoot, 'params.json');
    fs.writeFileSync(paramsFile, `${JSON.stringify({ sector: 'AI agent payments' }, null, 2)}\n`, 'utf8');

    const stdout = captureStdout();

    const code = await instantiateMain([
      '--template',
      'evaluate-startup-opportunity',
      '--params-file',
      paramsFile,
      '--founder-instructions',
      'Use conservative assumptions',
    ]);

    expect(code).toBe(0);
    const payload = getPrintedJson(stdout) as Record<string, unknown>;
    expect((payload.missionInstance as Record<string, unknown>).missionType).toBe('evaluate-startup-opportunity');
    expect((payload.missionIdentityPayload as Record<string, unknown>).missionType).toBe('evaluate-startup-opportunity');
    stdout.mockRestore();
  });

  it('T-MTPL-C4 missing flags produce deterministic errors', async () => {
    const stdout = captureStdout();

    const code = await instantiateMain(['--template', 'evaluate-startup-opportunity']);

    expect(code).toBe(1);
    expect(getPrintedJson(stdout)).toEqual({ error: 'MISSING_ARGUMENT: --params-file' });
    stdout.mockRestore();
  });

  it('T-MTPL-C5 invalid params file content is rejected', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const paramsFile = path.join(tmpRoot, 'invalid.json');
    fs.writeFileSync(paramsFile, `${JSON.stringify(['not-an-object'])}\n`, 'utf8');

    const stdout = captureStdout();

    const code = await instantiateMain([
      '--template',
      'evaluate-startup-opportunity',
      '--params-file',
      paramsFile,
    ]);

    expect(code).toBe(1);
    expect(getPrintedJson(stdout)).toEqual({ error: 'Invalid params file: expected JSON object' });
    stdout.mockRestore();
  });

  it('T-MTPL-C6 unknown template is rejected', async () => {
    const stdout = captureStdout();

    const code = await inspectMain(['--template', 'unknown-template']);

    expect(code).toBe(1);
    expect(getPrintedJson(stdout)).toEqual({ error: 'Unknown mission template: unknown-template' });
    stdout.mockRestore();
  });

  it('T-MTPL-C7 list output remains canonical across repeated calls', async () => {
    const stdoutOne = captureStdout();
    const firstCode = await listMain([]);
    const firstPayload = getPrintedJson(stdoutOne);
    stdoutOne.mockRestore();

    const stdoutTwo = captureStdout();
    const secondCode = await listMain([]);
    const secondPayload = getPrintedJson(stdoutTwo);
    stdoutTwo.mockRestore();

    expect(firstCode).toBe(0);
    expect(secondCode).toBe(0);
    expect(canonicalStringify(firstPayload)).toBe(canonicalStringify(secondPayload));
  });
});
