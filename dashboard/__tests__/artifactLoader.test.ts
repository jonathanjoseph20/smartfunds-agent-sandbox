import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ArtifactLoader } from '../artifactLoader.ts';
import { ArtifactLoaderError } from '../types.ts';

const fixturesRoot = path.join('dashboard', '__tests__', 'tmp-artifacts');

function writeFile(filePath: string, content: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

beforeEach(() => {
  fs.rmSync(fixturesRoot, { recursive: true, force: true });
  fs.mkdirSync(fixturesRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(fixturesRoot, { recursive: true, force: true });
});

describe('artifactLoader', () => {
  it('T-S86-AL1 discovers runs deterministically and ignores malformed root entries', () => {
    writeFile(path.join(fixturesRoot, 'mission-b', 'run_0002', 'report.md'), '# two\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0001', 'report.md'), '# one\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0001', 'run-metadata.json'), JSON.stringify({
      profile: 'lite',
      executionPath: 'lite',
      status: 'completed',
      artifactCount: 2
    }));
    writeFile(path.join(fixturesRoot, 'z-file.txt'), 'not a run\n');

    const loader = new ArtifactLoader(fixturesRoot);
    expect(loader.listRuns()).toEqual([
      {
        runId: 'run_0001',
        missionId: 'mission-a',
        profile: 'lite',
        executionPath: 'lite',
        status: 'completed',
        artifactCount: 2
      },
      { runId: 'run_0002', missionId: 'mission-b' }
    ]);
  });

  it('T-S86-AL2 returns empty runs when artifacts root is empty', () => {
    const loader = new ArtifactLoader(fixturesRoot);
    expect(loader.listRuns()).toEqual([]);
  });

  it('T-S86-AL3 returns run details without fabricating missing metadata and maps preview kinds', () => {
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0100', 'report.md'), '# Report\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0100', 'dataset.csv'), 'a,b\n1,2\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0100', 'research-pages.json'), '{"ok":true}\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0100', 'run-metadata.json'), JSON.stringify({
      profile: 'lite',
      executionPath: 'lite',
      artifactCount: 3
    }));

    const loader = new ArtifactLoader(fixturesRoot);
    expect(loader.getRunDetails('run_0100')).toEqual({
      runId: 'run_0100',
      missionId: 'mission-a',
      profile: 'lite',
      executionPath: 'lite',
      artifactCount: 3,
      artifacts: [
        { fileName: 'dataset.csv', previewKind: 'csv', sizeBytes: 8 },
        { fileName: 'report.md', previewKind: 'markdown', sizeBytes: 9 },
        { fileName: 'research-pages.json', previewKind: 'json', sizeBytes: 12 },
        { fileName: 'run-metadata.json', previewKind: 'json', sizeBytes: 59 }
      ]
    });
  });

  it('T-S86-AL4 parses markdown, csv, json and falls back to text for invalid json', () => {
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0200', 'report.md'), '# Title\n- item\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0200', 'dataset.csv'), 'name,score\nalice,10\n\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0200', 'good.json'), '{"k":1}\n');
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0200', 'bad.json'), '{oops\n');

    const loader = new ArtifactLoader(fixturesRoot);

    const markdown = loader.getArtifactPreview('run_0200', 'report.md');
    expect(markdown.previewKind).toBe('markdown');
    expect(markdown.content).toMatchObject({ markdown: '# Title\n- item\n' });

    const csv = loader.getArtifactPreview('run_0200', 'dataset.csv');
    expect(csv).toEqual({
      runId: 'run_0200',
      fileName: 'dataset.csv',
      previewKind: 'csv',
      content: {
        csv: {
          headers: ['name', 'score'],
          rows: [['alice', '10']]
        }
      }
    });

    const goodJson = loader.getArtifactPreview('run_0200', 'good.json');
    expect(goodJson.previewKind).toBe('json');
    expect(goodJson.content).toMatchObject({ json: { k: 1 } });

    const badJson = loader.getArtifactPreview('run_0200', 'bad.json');
    expect(badJson.previewKind).toBe('text');
    expect(badJson.content).toEqual({ text: '{oops\n' });
  });

  it('T-S86-AL5 returns unsupported for binary or unknown files', () => {
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0300', 'blob.bin'), Buffer.from([0, 159, 146, 150]));

    const loader = new ArtifactLoader(fixturesRoot);
    expect(loader.getArtifactPreview('run_0300', 'blob.bin')).toEqual({
      runId: 'run_0300',
      fileName: 'blob.bin',
      previewKind: 'unsupported',
      content: {
        unsupportedReason: 'Preview not supported for binary or unknown artifact type'
      }
    });
  });

  it('T-S86-AL6 handles missing run/file and path traversal rejection', () => {
    writeFile(path.join(fixturesRoot, 'mission-a', 'run_0400', 'report.md'), '# Report\n');
    const loader = new ArtifactLoader(fixturesRoot);

    expect(() => loader.getRunDetails('run_missing')).toThrowError('Run not found');

    expect(() => loader.getArtifactPreview('run_0400', 'missing.md')).toThrowError('Artifact not found');

    try {
      loader.getArtifactPreview('run_0400', '../secret.txt');
      throw new Error('expected invalid path');
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactLoaderError);
      expect((error as ArtifactLoaderError).code).toBe('INVALID_ARTIFACT_PATH');
    }
  });

  it('T-SPC-AL7 exposes build branch/pr metadata and mutation summary from run metadata', () => {
    writeFile(path.join(fixturesRoot, 'build-mission', 'run_0500', 'report.md'), '# Report\n');
    writeFile(path.join(fixturesRoot, 'build-mission', 'run_0500', 'run-metadata.json'), JSON.stringify({
      profile: 'build',
      executionPath: 'build',
      branchName: 'build/build-mission/abcd1234',
      prNumber: 12,
      prUrl: 'https://example.test/repo/pull/12',
      mutationSummary: ['docs/a.md', 'dashboard/ui/index.html']
    }));

    const loader = new ArtifactLoader(fixturesRoot);
    expect(loader.listRuns()).toEqual([
      {
        runId: 'run_0500',
        missionId: 'build-mission',
        profile: 'build',
        executionPath: 'build',
        branchName: 'build/build-mission/abcd1234',
        prNumber: 12,
        prUrl: 'https://example.test/repo/pull/12'
      }
    ]);

    expect(loader.getRunDetails('run_0500')).toMatchObject({
      runId: 'run_0500',
      missionId: 'build-mission',
      profile: 'build',
      executionPath: 'build',
      branchName: 'build/build-mission/abcd1234',
      prNumber: 12,
      prUrl: 'https://example.test/repo/pull/12',
      mutationSummary: ['dashboard/ui/index.html', 'docs/a.md']
    });
  });
});
