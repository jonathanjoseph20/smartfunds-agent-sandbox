import { describe, expect, it } from 'vitest';

import { runGovernanceValidation } from './validate.ts';

describe('governance validate isolation parity', () => {
  it('fails autonomous swarm context touching structured paths', async () => {
    const body = `tier-2

\`\`\`evidence
Risk Tier: 2
Justification: Structured change in autonomous mode
Affected Paths: control-plane/governance/diagnostics.ts
Tests Added: npm test
Determinism Statement: Deterministic and sorted outputs only
Swarm: swarm-contract-v1
Swarm Mode: autonomous
Swarm Team: governance
\`\`\``;

    const result = await runGovernanceValidation({
      prData: {
        body,
        labels: ['tier-2'],
        changedFiles: ['control-plane/governance/diagnostics.ts']
      },
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('isolation_violation:autonomous_governance_core_mutation');
    expect(result.report.isolationStatus).toBe('autonomous_governance_core_mutation');
    expect(result.report.isolationViolations).toEqual([
      'governance_core_mutation_attempt',
      'structured_path_in_autonomous_context'
    ]);
  });
});
