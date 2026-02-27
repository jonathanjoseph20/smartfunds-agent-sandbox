import { describe, expect, it } from 'vitest';

import {
  buildGovernanceReport,
  stringifyGovernanceReport,
  validateEvidenceBlockSchema
} from './diagnostics';

describe('governance diagnostics', () => {
  it('stringifies report with deterministic ordering', () => {
    const report = buildGovernanceReport({
      declaredTier: 2,
      impliedTier: 3,
      labelTier: 2,
      missingLabels: ['tier-2', 'tier-1', 'tier-2'],
      missingEvidenceFields: ['Tests Added', 'Affected Paths'],
      requiredChecks: ['unit_tests', 'lint_tier0'],
      projectsTouched: ['project-b', 'project-a'],
      teamsTouched: ['team-b', 'team-a'],
      swarmsDeclared: ['swarm-b', 'swarm-a', 'swarm-a'],
      swarmsTouched: ['swarm-b', 'swarm-a'],
      swarmOrchestrationStatus: 'violations',
      swarmOrchestrationViolations: ['b', 'a'],
      swarmDependencyEdges: [{ from: 'swarm-b', to: 'swarm-c' }, { from: 'swarm-a', to: 'swarm-c' }],
      swarmTopologicalOrder: ['swarm-a', 'swarm-b', 'swarm-c'],
      swarmPhaseBySwarm: { 'swarm-b': 'implement', 'swarm-a': 'setup' },
      swarmCycleDetected: ['swarm-b', 'swarm-a'],
      swarmWarnings: ['swarm_mode_without_swarm', 'invalid_swarm_mode'],
      swarmMode: null,
      swarmTeamId: 'governance',
      unownedFiles: ['z.md', 'a.md'],
      ownershipStatus: 'multi_project',
      entitiesTouched: ['entity-b', 'entity-a'],
      entityOwnershipStatus: 'multi_entity',
      unmappedProjects: ['project-z', 'project-y'],
      entityByProject: { 'project-z': null, 'project-a': 'entity-a' },
      entityRailProfileByEntity: { 'entity-b': 'hybrid', 'entity-a': null },
      entitiesMissingRailProfile: ['entity-a'],
      railBindingStatus: 'missing_rail_profile',
      railViolations: [
        {
          type: 'MIXED_INCOMPATIBLE_RAIL_PROFILES',
          details: 'z'
        },
        {
          type: 'ENTITY_MISSING_RAIL_PROFILE',
          entityId: 'entity-a',
          details: 'a'
        }
      ],
      nextActions: ['Run: git push', 'Add label: tier-3-approved.'],
      warnings: ['b', 'a'],
      executionModesTouched: ['structured', 'autonomous'],
      modeBoundaryStatus: 'multi_mode_conflict',
      conflictingTeams: ['team-b', 'team-a'],
      conflictingPaths: ['z.md', 'a.md'],
      swarmExecutionModesTouched: ['structured', 'autonomous'],
      modeWarnings: ['UNOWNED_PATHS', 'MIXED_MODE_PR'],
      unownedPaths: ['scripts/z.ts', 'scripts/a.ts'],
      ambiguousPaths: ['x.ts', 'a.ts']
    });

    const json = stringifyGovernanceReport(report);
    expect(json).toBe(
      JSON.stringify({
        declaredTier: 2,
        impliedTier: 3,
        labelTier: 2,
        missingLabels: ['tier-1', 'tier-2'],
        missingEvidenceFields: ['Affected Paths', 'Tests Added'],
        requiredChecks: ['lint_tier0', 'unit_tests'],
        projectsTouched: ['project-a', 'project-b'],
        teamsTouched: ['team-a', 'team-b'],
        swarmsDeclared: ['swarm-a', 'swarm-b'],
        swarmsTouched: ['swarm-a', 'swarm-b'],
        swarmOrchestrationStatus: 'violations',
        swarmOrchestrationViolations: ['a', 'b'],
        swarmDependencyEdges: [{ from: 'swarm-a', to: 'swarm-c' }, { from: 'swarm-b', to: 'swarm-c' }],
        swarmTopologicalOrder: ['swarm-a', 'swarm-b', 'swarm-c'],
        swarmPhaseBySwarm: { 'swarm-a': 'setup', 'swarm-b': 'implement' },
        swarmCycleDetected: ['swarm-b', 'swarm-a'],
        swarmWarnings: ['invalid_swarm_mode', 'swarm_mode_without_swarm'],
        swarmMode: null,
        swarmTeamId: 'governance',
        unownedFiles: ['a.md', 'z.md'],
        ownershipStatus: 'multi_project',
        entitiesTouched: ['entity-a', 'entity-b'],
        entityOwnershipStatus: 'multi_entity',
        unmappedProjects: ['project-y', 'project-z'],
        entityByProject: { 'project-a': 'entity-a', 'project-z': null },
        entityRailProfileByEntity: { 'entity-a': null, 'entity-b': 'hybrid' },
        entitiesMissingRailProfile: ['entity-a'],
        railBindingStatus: 'missing_rail_profile',
        railViolations: [
          {
            type: 'ENTITY_MISSING_RAIL_PROFILE',
            entityId: 'entity-a',
            details: 'a'
          },
          {
            type: 'MIXED_INCOMPATIBLE_RAIL_PROFILES',
            details: 'z'
          }
        ],
        nextActions: ['Add label: tier-3-approved.', 'Run: git push'],
        warnings: ['a', 'b'],
        executionModesTouched: ['autonomous', 'structured'],
        modeBoundaryStatus: 'multi_mode_conflict',
        conflictingTeams: ['team-a', 'team-b'],
        conflictingPaths: ['a.md', 'z.md'],
        swarmExecutionModesTouched: ['autonomous', 'structured'],
        modeWarnings: ['MIXED_MODE_PR', 'UNOWNED_PATHS'],
        unownedPaths: ['scripts/a.ts', 'scripts/z.ts'],
        ambiguousPaths: ['a.ts', 'x.ts'],
        modeEnforcementStatus: 'failed',
        modeViolation: 'mixed_execution_modes',
        requiredMinimumTier: null
      })
    );
  });

  it('tracks missing evidence fields when evidence block is missing', () => {
    const result = validateEvidenceBlockSchema('No evidence here');
    expect(result.missingFields).toContain('Risk Tier');
    expect(result.missingFields).toContain('Determinism Statement');
    expect(result.errors.join('\n')).toContain('Missing fenced evidence block');
  });
});
