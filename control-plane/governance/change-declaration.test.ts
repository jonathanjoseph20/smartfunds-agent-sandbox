import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { readChangeDeclaration } from './change-declaration.ts';

function withMockedFile(
  content: string | null,
  run: () => void
): void {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);

  vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
    if (String(filePath) === 'governance/change.json') {
      return content !== null;
    }
    return originalExistsSync(filePath);
  });

  vi.spyOn(fs, 'readFileSync').mockImplementation(
    (
      filePath: fs.PathOrFileDescriptor,
      options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null
    ) => {
      if (String(filePath) === 'governance/change.json') {
        return content ?? '';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalReadFileSync(filePath as any, options as any);
    }
  );

  try {
    run();
  } finally {
    vi.restoreAllMocks();
  }
}

describe('readChangeDeclaration', () => {
  it('returns ok:false when file is missing', () => {
    withMockedFile(null, () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]).toContain('Missing governance/change.json');
      }
    });
  });

  it('returns ok:false when file is not valid JSON', () => {
    withMockedFile('not json {{{', () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]).toContain('not valid JSON');
      }
    });
  });

  it('returns ok:false when tier is invalid', () => {
    withMockedFile(JSON.stringify({ tier: 5, mode: 'structured', justification: 'x' }), () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.join('\n')).toContain('"tier" must be 0, 1, 2, or 3');
      }
    });
  });

  it('returns ok:false when mode is invalid', () => {
    withMockedFile(JSON.stringify({ tier: 1, mode: 'unknown', justification: 'x' }), () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.join('\n')).toContain('"mode" must be');
      }
    });
  });

  it('returns ok:false when justification is empty', () => {
    withMockedFile(JSON.stringify({ tier: 1, mode: 'structured', justification: '   ' }), () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.join('\n')).toContain('"justification" must be a non-empty string');
      }
    });
  });

  it('returns all validation errors together', () => {
    withMockedFile(JSON.stringify({ tier: 99, mode: 'bad', justification: '' }), () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(3);
      }
    });
  });

  it('returns ok:true with parsed declaration for a valid file', () => {
    const content = JSON.stringify({ tier: 2, mode: 'structured', justification: 'Adding core feature' });
    withMockedFile(content, () => {
      const result = readChangeDeclaration();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.declaration.tier).toBe(2);
        expect(result.declaration.mode).toBe('structured');
        expect(result.declaration.justification).toBe('Adding core feature');
      }
    });
  });

  it('accepts all valid tiers', () => {
    for (const tier of [0, 1, 2, 3] as const) {
      const content = JSON.stringify({ tier, mode: 'autonomous', justification: 'valid' });
      withMockedFile(content, () => {
        const result = readChangeDeclaration();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.declaration.tier).toBe(tier);
        }
      });
    }
  });
});
