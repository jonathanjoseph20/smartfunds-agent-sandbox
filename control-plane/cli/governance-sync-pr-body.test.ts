import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildGovernancePrBodySummary } from './governance-sync-pr-body.ts';

const tempDirs: string[] = [];

function createEvidenceFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-sync-'));
  tempDirs.push(dir);
  const schemaDir = path.join(dir, 'governance/schema');
  fs.mkdirSync(schemaDir, { recursive: true });
  fs.copyFileSync('governance/schema/evidence.schema.json', path.join(schemaDir, 'evidence.schema.json'));
  const evidencePath = path.join(dir, 'governance/evidence.json');
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, content, 'utf8');
  return evidencePath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('governance:sync-pr-body', () => {
  it('renders deterministic markdown summary from evidence.json', () => {
    const evidencePath = createEvidenceFile(
      JSON.stringify({
        tier: 3,
        mode: 'structured',
        affectedPaths: ['b.ts', 'a.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );

    const summary = buildGovernancePrBodySummary(evidencePath);
    expect(summary).toContain('### Governance Evidence (Informational)');
    expect(summary).toContain('- Tier: 3');
    expect(summary).toContain('  - a.ts');
    expect(summary).toContain('  - b.ts');
  });
});
