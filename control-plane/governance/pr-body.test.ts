import { describe, expect, it } from 'vitest';

import { hasEvidenceFence, parseTierLine, validatePrBody } from './pr-body';

const baseBody = `tier-2\n\n\`\`\`evidence\nRisk Tier: 2\nJustification: ok\nAffected Paths: apps/api/src/index.ts\nTests Added: npm test\nDeterminism Statement: deterministic\n\`\`\``;

describe('pr body validator', () => {
  it('accepts exactly one unfenced tier line', () => {
    expect(parseTierLine(baseBody)).toBe('tier-2');
  });

  it('requires tier line outside fenced blocks', () => {
    const body = `\`\`\`\ntier-1\n\`\`\`\n\n\`\`\`evidence\nRisk Tier: 2\nJustification: ok\nAffected Paths: apps/api/src/index.ts\nTests Added: npm test\nDeterminism Statement: deterministic\n\`\`\``;
    expect(() => parseTierLine(body)).toThrow('Missing unfenced tier line');
  });

  it('rejects missing tier line', () => {
    const body = baseBody.replace('tier-2\n\n', '');
    expect(() => parseTierLine(body)).toThrow('Missing unfenced tier line');
  });

  it('rejects tier lines with unsupported tokens', () => {
    const body = `tier-3-approved\n\n${baseBody}`;
    expect(() => parseTierLine(body)).toThrow('Unsupported tier declaration');
  });

  it('requires exact evidence fence lines', () => {
    expect(() => hasEvidenceFence(baseBody)).not.toThrow();

    const missing = baseBody.replace('```evidence', ' ```evidence');
    expect(() => hasEvidenceFence(missing)).toThrow('Missing evidence fence');

    const noClose = baseBody.replace(/\n```$/, '\n');
    expect(() => hasEvidenceFence(noClose)).toThrow('Evidence fence is not closed');
  });

  it('validates tier and evidence together', () => {
    expect(validatePrBody(baseBody)).toEqual({ tier: 'tier-2' });
  });
});
