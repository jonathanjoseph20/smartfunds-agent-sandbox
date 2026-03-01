import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runGovernanceEmit } from './governance-emit.ts';
import { readEvidenceContract } from '../governance/evidence-contract.ts';

const tempDirs: string[] = [];

function makeTempFile(fileName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-emit-'));
  tempDirs.push(dir);
  return path.join(dir, fileName);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('governance:emit', () => {
  it('writes deterministic schema-valid evidence json', async () => {
    const outFile = makeTempFile('evidence.json');
    const result = await runGovernanceEmit(
      [
        '--tier=3',
        '--mode=structured',
        '--determinism-statement=No identity surfaces mutated.',
        '--retry-semantics-modified=false',
        '--autonomy-scope-expanded=false',
        '--out-file',
        outFile
      ],
      {
        gitExec: () => 'b.ts\na.ts\na.ts'
      }
    );

    expect(result.changedFiles).toEqual(['a.ts', 'b.ts']);
    const file = fs.readFileSync(outFile, 'utf8');
    expect(file).toBe(
      '{\n' +
      '  "affectedPaths": [\n' +
      '    "a.ts",\n' +
      '    "b.ts"\n' +
      '  ],\n' +
      '  "autonomyScopeExpanded": false,\n' +
      '  "determinismStatement": "No identity surfaces mutated.",\n' +
      '  "mode": "structured",\n' +
      '  "retrySemanticsModified": false,\n' +
      '  "tier": 3\n' +
      '}\n'
    );

    const parsed = readEvidenceContract({
      evidencePath: outFile
    });
    expect(parsed.exists).toBe(true);
    expect('evidence' in parsed).toBe(true);
  });
});
