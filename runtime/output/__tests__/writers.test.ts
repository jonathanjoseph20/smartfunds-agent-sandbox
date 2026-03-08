import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ArtifactWriter } from '../artifact-writer.ts';
import { writeCsv } from '../csv-writer.ts';
import { SourceRegistry } from '../source-registry.ts';
import { writeXlsx } from '../xlsx-writer.ts';

const tmpRoot = path.join('runtime', 'output', '__tests__', 'tmp-output');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime output writers', () => {
  it('T-E1 writes CSV with deterministic column and row ordering', () => {
    const csv = writeCsv({
      rows: [
        { b: '2', a: 'x' },
        { b: '1', a: 'z' }
      ]
    });

    expect(csv).toBe([
      'a,b',
      'x,2',
      'z,1',
      ''
    ].join('\n'));
  });

  it('T-E2 writes deterministic XLSX bytes independent of input sheet order', () => {
    const first = writeXlsx({
      sheets: [
        { name: 'B', rows: [{ b: 2 }] },
        { name: 'A', rows: [{ a: 1 }] }
      ]
    });

    const second = writeXlsx({
      sheets: [
        { name: 'A', rows: [{ a: 1 }] },
        { name: 'B', rows: [{ b: 2 }] }
      ]
    });

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(Buffer.from(first).toString('utf8')).toContain('sheet name="A"');
    expect(Buffer.from(first).toString('utf8')).toContain('sheet name="B"');
  });

  it('T-E3 source registry deduplicates and sorts lexicographically', () => {
    const registry = new SourceRegistry();
    registry.add({ url: 'https://b.example/x', firstSeenStep: 'step-2' });
    registry.add({ url: 'https://a.example/x', firstSeenStep: 'step-5' });
    registry.add({ url: 'https://b.example/x', firstSeenStep: 'step-1' });

    expect(registry.list()).toEqual([
      { url: 'https://a.example/x', domain: 'a.example', firstSeenStep: 'step-5' },
      { url: 'https://b.example/x', domain: 'b.example', firstSeenStep: 'step-1' }
    ]);
  });

  it('T-E4 artifact writer enforces declaration and deterministic naming', () => {
    const writer = new ArtifactWriter(tmpRoot, [
      { artifactId: 'report_csv', format: 'csv' },
      { artifactId: 'report_xlsx', format: 'xlsx' },
      { artifactId: 'manifest', format: 'artifact' }
    ]);

    const csvPath = writer.writeCsv({
      missionId: 'mission',
      runId: 'run',
      artifactId: 'report_csv',
      rows: [{ a: 1 }]
    });

    expect(csvPath).toBe(path.join(tmpRoot, 'mission', 'run', 'report_csv.csv'));
    expect(fs.existsSync(csvPath)).toBe(true);

    expect(() => writer.writeArtifact({
      missionId: 'mission',
      runId: 'run',
      artifactId: 'unknown',
      payload: { ok: true }
    })).toThrow('ERR_ARTIFACT_UNDECLARED: unknown');
  });
});
