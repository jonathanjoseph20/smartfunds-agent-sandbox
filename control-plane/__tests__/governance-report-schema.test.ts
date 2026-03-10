import { describe, expect, it } from 'vitest';

import { buildGovernanceReport } from '../governance/diagnostics';

describe('governance report schema guard', () => {
  it('includes stable telemetry and ownership fields', () => {
    const report = buildGovernanceReport({
      requestedProfile: 'build',
      requiredProfile: 'build',
      finalProfile: 'build',
      matchedScopes: ['docs/readme.md'],
      routingSource: 'fallback',
      declaredTier: null,
      impliedTier: 0,
      labelTier: null,
      missingLabels: [],
      missingEvidenceFields: [],
      requiredChecks: ['lint'],
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
      requestedProfile: 'build',
      requiredProfile: 'build',
      finalProfile: 'build',
      matchedScopes: ['docs/readme.md'],
      routingSource: 'fallback',
      projectsTouched: [],
      teamsTouched: [],
      swarmsDeclared: [],
      swarmsTouched: [],
      swarmOrchestrationStatus: 'ok',
      swarmOrchestrationViolations: [],
      swarmDependencyEdges: [],
      swarmTopologicalOrder: [],
      swarmPhaseBySwarm: {},
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
      railViolations: [],
      errors: []
    });

    expect(report.modeEnforcementStatus).toBe('ok');
    expect(report.modeViolation).toBeNull();
    expect(report.requiredMinimumTier).toBeNull();
    expect(report.metadataSource).toEqual({
      bodySource: 'stub',
      bodyPath: null,
      labelSource: 'stub',
      labelsPath: null,
      commentSource: 'none'
    });
    expect(report.commentEvidenceDetected).toBe(false);
    expect(report.commentEvidenceCount).toBe(0);
    expect(report.sealWarnings).toEqual([]);
    expect(report.executionContext).toEqual({
      context: 'local',
      executionMode: 'unknown',
      retryEnabled: false
    });
    expect(report.retryTrace).toEqual({
      attempted: false,
      retryCount: 0,
      initialStatus: 'passed',
      finalStatus: 'passed',
      triggerErrorCode: null,
      retryable: false,
      patchApplied: null
    });
  });
});
