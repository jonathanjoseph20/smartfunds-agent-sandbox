import { describe, expect, it } from 'vitest';

import { parsePrBodyForGovernance } from './evidence-parse.ts';
import { validateParsedEvidence } from './evidence-validate.ts';

const validBody = `tier-1

\`\`\`evidence
Risk Tier: 1
Justification: Low risk
Affected Paths: apps/api/src/index.ts
Tests Added: npm test
Determinism Statement: Deterministic and reproducible
\`\`\``;

describe('validateParsedEvidence', () => {
  it('returns valid result for legacy metadata', () => {
    const parsed = parsePrBodyForGovernance(validBody);
    const result = validateParsedEvidence(parsed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('Legacy evidence block detected.');
  });

  it('does not fail when tier line is absent', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('tier-1\n\n', ''));
    const result = validateParsedEvidence(parsed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('does not fail when tier label is malformed', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('tier-1', 'tier-9'));
    const result = validateParsedEvidence(parsed);

    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('Legacy evidence format issues ignored');
  });

  it('does not fail when evidence fence is missing', () => {
    const parsed = parsePrBodyForGovernance('tier-1\n\nmissing evidence');
    const result = validateParsedEvidence(parsed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('surfaces missing legacy evidence fields as warnings only', () => {
    const parsed = parsePrBodyForGovernance(`tier-1

\`\`\`evidence
Risk Tier: 1
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('Legacy evidence fields missing');
  });

  it('surfaces unsupported legacy keys as warnings only', () => {
    const parsed = parsePrBodyForGovernance(`tier-1

\`\`\`evidence
Risk Tier: 1
Justification: ok
Affected Paths: apps/api/src/index.ts
Tests: npm test
Determinism: deterministic
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('Legacy evidence fields ignored');
  });

  it('surfaces malformed legacy lines as warnings only', () => {
    const parsed = parsePrBodyForGovernance(`tier-1

\`\`\`evidence
Risk Tier: 1
Justification only
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('Legacy evidence format issues ignored');
  });

  it('sorts warnings deterministically', () => {
    const parsed = parsePrBodyForGovernance(`tier-9

\`\`\`evidence
Justification only
Tests: no
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([...result.warnings].sort((left, right) => left.localeCompare(right)));
  });
});
