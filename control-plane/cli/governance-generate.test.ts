import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { generateBody } from './governance-generate';

describe('governance:generate', () => {
  it('produces deterministic template output', () => {
    const body = generateBody({
      tier: 2,
      changedPaths: ['package.json', 'control-plane/cli/governance-generate.ts']
    });

    expect(body).toMatchInlineSnapshot(`"tier-2\n\n\`\`\`evidence\nRisk Tier: 2\nJustification: <placeholder>\nAffected Paths: control-plane/cli/governance-generate.ts, package.json\nTests Added: <placeholder>\nDeterminism Statement: Deterministic; no randomness, no hidden mutation, sorted output.\n\`\`\`\n\n### Determinism Requirements\n- Backticks generated programmatically (ASCII \\140)\n- LF line endings only\n- No trailing whitespace\n- Deterministic field ordering\n- Sorted path output\n- Stable placeholder ordering"`);
  });

  it('avoids literal triple backticks in generator source', () => {
    const source = fs.readFileSync('control-plane/cli/governance-generate.ts', 'utf8');
    expect(source.includes('```')).toBe(false);
  });
});
