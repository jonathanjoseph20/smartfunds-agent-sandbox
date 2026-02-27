import { describe, expect, it } from 'vitest';

import { stringifyGovernanceReport } from '../governance/diagnostics';
import { buildPreflightReport } from './governance-preflight';

const baseBody = `tier-1

\`\`\`evidence
Risk Tier: 1
Justification: App-only change
Affected Paths: apps/api/src/index.ts
Tests Added: npm --workspace @smartfunds/api run test
Determinism Statement: Deterministic; no randomness, no hidden mutation, sorted output.
\`\`\``;

function makeOwnership(override: Partial<ReturnType<typeof makeOwnership>> = {}) {
  return {
    projectsTouched: ['core-app'],
    teamsTouched: ['team-a'],
    unownedFiles: [],
    ownershipStatus: 'ok' as const,
    nextActions: [],
    ...override
  };
}

describe('governance:preflight', () => {
  it('passes when body, evidence, and implied tier are aligned', () => {
    const result = buildPreflightReport(baseBody, ['apps/api/src/index.ts'], [], {
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    });

    expect(result.ok).toBe(true);
    expect(result.report.labelTier).toBe(1);
    expect(result.report.missingEvidenceFields.length).toBe(0);
    expect(result.report.teamsTouched).toEqual(['product-app']);
    expect(result.report.executionModesTouched).toEqual(['autonomous']);
  });

  it('fails when evidence block is missing', () => {
    const result = buildPreflightReport('tier-1', ['apps/api/src/index.ts'], [], {
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    });

    expect(result.ok).toBe(false);
    expect(result.report.missingEvidenceFields).toContain('Risk Tier');
    expect(result.errors.join('\n')).toContain('Missing fenced evidence block');
  });

  it('fails structured-mode changes declared below tier-2', () => {
    const result = buildPreflightReport(baseBody, ['governance/policy.ts'], [], {
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    });

    expect(result.ok).toBe(false);
    expect(result.report.executionModesTouched).toEqual(['structured']);
    expect(result.report.modeEnforcementStatus).toBe('failed');
    expect(result.report.modeViolation).toBe('structured_min_tier_violation');
    expect(result.report.requiredMinimumTier).toBe(2);
    expect(result.errors.join('\n')).toContain('structured execution mode requires declared tier-2 or tier-3');
  });

  it('enforces tier-3 approval via local convention', () => {
    const body = `tier-3

\`\`\`evidence
Risk Tier: 3
Justification: Sensitive change
Affected Paths: control-plane/validate-pr.ts
Tests Added: npm test
Determinism Statement: Deterministic; no randomness, no hidden mutation, sorted output.
\`\`\``;

    const result = buildPreflightReport(body, ['control-plane/validate-pr.ts'], [], {
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    });

    expect(result.ok).toBe(false);
    expect(result.report.missingLabels).toContain('tier-3-approved');
    expect(result.errors.join('\n')).toContain(
      "Tier 3 requires tier-3-approved. Add an unfenced line 'tier-3-approved' to .pr-body.md (local only) or create .pr-labels.txt listing tier-3-approved."
    );
  });

  it('reports multi-project ownership status', () => {
    const result = buildPreflightReport(baseBody, ['apps/api/src/index.ts'], [], {
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () =>
        makeOwnership({
          ownershipStatus: 'multi_project',
          projectsTouched: ['project-a', 'project-b'],
          nextActions: ['Split changes by project.']
        })
    });

    expect(result.ok).toBe(false);
    expect(result.report.ownershipStatus).toBe('multi_project');
    expect(result.errors.join('\n')).toContain('Ownership violation: changes span multiple projects.');
  });

  it('does not fail mixed-mode PRs outside validate-pr (T-M23)', () => {
    const result = buildPreflightReport(
      baseBody,
      ['apps/api/src/index.ts', '.github/workflows/ci.yml'],
      [],
      {
        loadProjects: () => [],
        loadTeams: () => [],
        resolveOwnership: () => makeOwnership()
      }
    );

    expect(result.ok).toBe(true);
    expect(result.report.modeViolation).toBe('mixed_execution_modes');
  });

  it('stringifies governance report deterministically', () => {
    const result = buildPreflightReport(baseBody, ['apps/api/src/index.ts'], ['tier-3-approved'], {
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () =>
        makeOwnership({
          projectsTouched: ['project-b', 'project-a'],
          teamsTouched: ['team-b', 'team-a']
        })
    });

    const json = stringifyGovernanceReport(result.report);
    expect(json).toMatchInlineSnapshot(`"{\"declaredTier\":1,\"impliedTier\":1,\"labelTier\":1,\"missingLabels\":[],\"missingEvidenceFields\":[],\"requiredChecks\":[\"lint_tier0\",\"unit_tests\"],\"projectsTouched\":[\"project-a\",\"project-b\"],\"teamsTouched\":[\"product-app\"],\"swarmsTouched\":[],\"unownedFiles\":[],\"ownershipStatus\":\"ok\",\"entitiesTouched\":[],\"entityOwnershipStatus\":\"unknown_entity_mapping\",\"unmappedProjects\":[\"project-a\",\"project-b\"],\"entityByProject\":{\"project-a\":null,\"project-b\":null},\"entityRailProfileByEntity\":{},\"entitiesMissingRailProfile\":[],\"railBindingStatus\":\"ok\",\"railViolations\":[],\"nextActions\":[\"Add missing projectId to control-plane/entities/registry.json.\"],\"warnings\":[],\"executionModesTouched\":[\"autonomous\"],\"modeBoundaryStatus\":\"ok\",\"conflictingTeams\":[],\"conflictingPaths\":[],\"swarmExecutionModesTouched\":[],\"modeWarnings\":[],\"unownedPaths\":[],\"ambiguousPaths\":[],\"modeEnforcementStatus\":\"ok\",\"modeViolation\":null,\"requiredMinimumTier\":null}"`);
  });

  it('reports swarms touched for project-level mappings', () => {
    const result = buildPreflightReport(baseBody, ['docs/swarm-v1.md'], [], {
      readFile: () => baseBody
    });

    expect(result.report.projectsTouched).toEqual(['docs']);
    expect(result.report.swarmsTouched).toEqual(['dev-team', 'example-research', 'executive-team']);
    expect(result.report.swarmExecutionModesTouched).toEqual(['autonomous', 'structured']);
  });
});
