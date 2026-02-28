import { describe, expect, it, vi } from 'vitest';

import { runGovernanceValidation } from './validate.ts';

function makeValidBody(): string {
  return `tier-2

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
}

describe('governance validate isolation parity', () => {
  it('fails autonomous swarm context touching structured paths', async () => {
    const result = await runGovernanceValidation({
      prData: {
        body: makeValidBody(),
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

  it('adds EVIDENCE_IN_COMMENT_NOT_BODY when invalid body payload exists in comments', async () => {
    const result = await runGovernanceValidation({
      prData: {
        body: 'Missing governance payload in body',
        labels: ['tier-2'],
        changedFiles: ['apps/api/src/index.ts']
      },
      prNumber: 42,
      repository: 'owner/repo',
      commentFetcher: async () => [
        { id: 101, body: 'tier-2\n\n```evidence\nRisk Tier: 2\n```' }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'EVIDENCE_IN_COMMENT_NOT_BODY: Governance payload detected in PR comments, but PR body is invalid. Move payload to PR description.'
    );
    expect(result.report.errors.map((error) => error.code)).toContain('EVIDENCE_IN_COMMENT_NOT_BODY');
    expect(result.report.commentEvidenceDetected).toBe(true);
    expect(result.report.commentEvidenceCount).toBe(1);
    expect(result.report.metadataSource.commentSource).toBe('gh');
    expect(result.report.nextActions).toContain('Run: npm run pr:seal -- --pr 42 --tier 2 --evidence-file <path>');
  });

  it('does not add comment evidence error when comments do not contain payload', async () => {
    const result = await runGovernanceValidation({
      prData: {
        body: 'Missing governance payload in body',
        labels: ['tier-1'],
        changedFiles: ['apps/api/src/index.ts']
      },
      prNumber: 7,
      repository: 'owner/repo',
      commentFetcher: async () => [{ id: 1, body: 'No governance payload here' }]
    });

    expect(result.errors.join('\n')).not.toContain('EVIDENCE_IN_COMMENT_NOT_BODY');
    expect(result.report.commentEvidenceDetected).toBe(false);
    expect(result.report.commentEvidenceCount).toBe(0);
    expect(result.report.metadataSource.commentSource).toBe('gh');
  });

  it('skips comment scan when body is already valid', async () => {
    const commentFetcher = vi.fn(async () => [{ id: 5, body: 'tier-2\n\n```evidence\nRisk Tier: 2\n```' }]);

    const result = await runGovernanceValidation({
      prData: {
        body: makeValidBody(),
        labels: ['tier-2'],
        changedFiles: ['apps/api/src/index.ts']
      },
      prNumber: 13,
      repository: 'owner/repo',
      commentFetcher
    });

    expect(commentFetcher).not.toHaveBeenCalled();
    expect(result.report.metadataSource.commentSource).toBe('none');
    expect(result.report.commentEvidenceDetected).toBe(false);
    expect(result.report.commentEvidenceCount).toBe(0);
  });
});
