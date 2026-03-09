import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { stableStringify, writeArtifact } from './artifact-writer.ts';

const root = process.cwd();
const tmpRoot = path.join(root, '.test-artifacts');

beforeEach(() => {
  fs.mkdirSync(tmpRoot, { recursive: true });
  process.chdir(tmpRoot);
});

afterEach(() => {
  process.chdir(root);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime output artifact writer api', () => {
  it('T-A82-4 writes markdown, json, csv, and text artifacts', () => {
    const markdownPath = writeArtifact({
      missionId: 'm1',
      runId: 'run-1',
      type: 'markdown',
      filename: 'report.md',
      content: '# Deterministic Report\n'
    });

    const jsonPath = writeArtifact({
      missionId: 'm1',
      runId: 'run-1',
      type: 'json',
      filename: 'summary.json',
      content: { z: 1, a: { y: 2, b: 1 } }
    });

    const csvPath = writeArtifact({
      missionId: 'm1',
      runId: 'run-1',
      type: 'csv',
      filename: 'dataset.csv',
      content: {
        rows: [
          { b: 2, a: 'y' },
          { b: 1, a: 'x' }
        ]
      }
    });

    const textPath = writeArtifact({
      missionId: 'm1',
      runId: 'run-1',
      type: 'text',
      filename: 'logs.txt',
      content: 'line-1\nline-2\n'
    });

    expect(markdownPath).toBe(path.join('artifacts', 'm1', 'run-1', 'report.md'));
    expect(fs.readFileSync(markdownPath, 'utf8')).toBe('# Deterministic Report\n');

    expect(jsonPath).toBe(path.join('artifacts', 'm1', 'run-1', 'summary.json'));
    expect(fs.readFileSync(jsonPath, 'utf8')).toBe([
      '{',
      '  "a": {',
      '    "b": 1,',
      '    "y": 2',
      '  },',
      '  "z": 1',
      '}',
      ''
    ].join('\n'));

    expect(csvPath).toBe(path.join('artifacts', 'm1', 'run-1', 'dataset.csv'));
    expect(fs.readFileSync(csvPath, 'utf8')).toBe('a,b\nx,1\ny,2\n');

    expect(textPath).toBe(path.join('artifacts', 'm1', 'run-1', 'logs.txt'));
    expect(fs.readFileSync(textPath, 'utf8')).toBe('line-1\nline-2\n');
  });

  it('T-A82-5 stableStringify uses alphabetical key ordering and 2-space indentation', () => {
    const output = stableStringify({ b: 1, a: { d: 2, c: 1 } });
    expect(output).toBe([
      '{',
      '  "a": {',
      '    "c": 1,',
      '    "d": 2',
      '  },',
      '  "b": 1',
      '}'
    ].join('\n'));
  });

  it('T-A82-6 produces repeatable deterministic output across runs', () => {
    const first = writeArtifact({
      missionId: 'm2',
      runId: 'run-1',
      type: 'json',
      filename: 'summary.json',
      content: { b: 1, a: 2 }
    });

    const second = writeArtifact({
      missionId: 'm2',
      runId: 'run-2',
      type: 'json',
      filename: 'summary.json',
      content: { a: 2, b: 1 }
    });

    const firstContents = fs.readFileSync(first, 'utf8');
    const secondContents = fs.readFileSync(second, 'utf8');

    expect(firstContents).toBe(secondContents);
  });

  it('T-A82-7 sorts csv string lines deterministically', () => {
    const filePath = writeArtifact({
      missionId: 'm3',
      runId: 'run-1',
      type: 'csv',
      filename: 'dataset.csv',
      content: 'c,3\na,1\nb,2\n'
    });

    expect(fs.readFileSync(filePath, 'utf8')).toBe('a,1\nb,2\nc,3\n');
  });
});
