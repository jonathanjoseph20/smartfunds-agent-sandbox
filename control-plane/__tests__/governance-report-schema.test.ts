import { describe, expect, it } from 'vitest';

import { buildGovernanceReport } from '../governance/diagnostics';

describe('governance report schema guard', () => {
  it('includes stable telemetry and ownership fields', () => {
    const report = buildGovernanceReport({
      declaredTier: null,
      impliedTier: 0,
      labelTier: 0,
      missingLabels: [],
      missingEvidenceFields: [],
      requiredChecks: ['lint_tier0'],
      projectsTouched: [],
      teamsTouched: [],
      swarmsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      entitiesTouched: [],
      entityOwnershipStatus: 'ok',
      unmappedProjects: [],
      entityByProject: {},
      entityRailProfileByEntity: {},
      entitiesMissingRailProfile: [],
      railBindingStatus: 'ok',
      railViolations: [],
      nextActions: [],
      warnings: [],
      executionModesTouched: [],
      modeBoundaryStatus: 'ok',
      conflictingTeams: [],
      conflictingPaths: [],
      swarmExecutionModesTouched: [],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: []
    });

    expect(report).toMatchObject({
      projectsTouched: [],
      teamsTouched: [],
      swarmsDeclared: [],
      swarmsTouched: [],
      swarmWarnings: [],
      swarmMode: null,
      swarmTeamId: null,
      executionModesTouched: [],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: [],
      ownershipStatus: 'ok',
      entitiesTouched: [],
      entityOwnershipStatus: 'ok',
      unmappedProjects: [],
      entityByProject: {},
      entityRailProfileByEntity: {},
      entitiesMissingRailProfile: [],
      railBindingStatus: 'ok',
      railViolations: []
    });

    expect(report.modeEnforcementStatus).toBe('ok');
    expect(report.modeViolation).toBeNull();
    expect(report.requiredMinimumTier).toBeNull();
  });
});
