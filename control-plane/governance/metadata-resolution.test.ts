import { describe, expect, it } from 'vitest';

import { resolveLocalMetadata } from './metadata-resolution.ts';

function buildFs(files: Record<string, string>) {
  return {
    existsSync: (filePath: string) => Object.prototype.hasOwnProperty.call(files, filePath),
    readFile: (filePath: string) => files[filePath]
  };
}

describe('local metadata resolution', () => {
  it('resolves body by precedence and marks template fallback explicitly', () => {
    const fsStub = buildFs({
      '.github/pull_request_template.md': 'template body'
    });

    const resolved = resolveLocalMetadata({
      readFile: fsStub.readFile,
      existsSync: fsStub.existsSync
    });

    expect(resolved.body).toBe('template body');
    expect(resolved.metadataSource).toEqual({
      bodySource: 'template',
      bodyPath: '.github/pull_request_template.md',
      labelSource: 'stub',
      labelsPath: null
    });
  });

  it('prefers explicit CLI files for body and labels', () => {
    const fsStub = buildFs({
      'body.md': 'cli body',
      'labels.txt': 'tier-3-approved\ncodex',
      '.pr-body.md': 'stub body',
      '.pr-labels.txt': 'tier-1'
    });

    const resolved = resolveLocalMetadata({
      bodyFile: 'body.md',
      labelsFile: 'labels.txt',
      readFile: fsStub.readFile,
      existsSync: fsStub.existsSync
    });

    expect(resolved.body).toBe('cli body');
    expect(resolved.labels).toEqual(['tier-3-approved', 'codex']);
    expect(resolved.metadataSource).toEqual({
      bodySource: 'cli',
      bodyPath: 'body.md',
      labelSource: 'cli',
      labelsPath: 'labels.txt'
    });
  });

  it('uses stub fallbacks before template and before none for labels', () => {
    const fsStub = buildFs({
      '.pr-body.md': 'dot body',
      'pr-body.md': 'plain body',
      '.pr-labels.txt': 'tier-1',
      'pr-labels.txt': 'tier-2'
    });

    const resolved = resolveLocalMetadata({
      readFile: fsStub.readFile,
      existsSync: fsStub.existsSync
    });

    expect(resolved.body).toBe('dot body');
    expect(resolved.labels).toEqual(['tier-1']);
    expect(resolved.metadataSource).toEqual({
      bodySource: 'stub',
      bodyPath: '.pr-body.md',
      labelSource: 'stub',
      labelsPath: '.pr-labels.txt'
    });
  });
});
