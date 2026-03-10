import { describe, expect, it } from 'vitest';

import {
  buildGovernanceReport,
  stringifyGovernanceReport
} from './diagnostics';

describe('governance diagnostics', () => {
  it('stringifies report with deterministic ordering and profile-native fields', () => {
    const report = buildGovernanceReport({
      requestedProfile: 'build',
      requiredProfile: 'core',
      finalProfile: 'core',
      matchedScopes: ['z/path.ts', 'a/path.ts', 'a/path.ts'],
      routingSource: 'policy-registry',
      declaredTier: null,
      impliedTier: null,
      labelTier: null,
      missingLabels: ['tier-2', 'tier-1', 'tier-2'],
      missingEvidenceFields: ['Tests Added', 'Affected Paths'],
      requiredChecks: ['unit_tests', 'lint'],
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
      autonomousContextDetected: true,
      branchNamespaceValid: false,
      structuredPathsTouched: [
        'control-plane/governance/diagnostics.ts',
        'control-plane/entities/rails.json',
        'control-plane/governance/diagnostics.ts'
      ],
      autonomousPathsTouched: ['docs/z.md', 'docs/a.md', 'docs/a.md'],
      isolationStatus: 'autonomous_governance_core_mutation',
      isolationViolations: [
        'structured_path_in_autonomous_context',
        'governance_core_mutation_attempt',
        'structured_path_in_autonomous_context'
      ],
      nextActions: ['Run: git push', 'Review ownership diagnostics'],
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

    const parsed = JSON.parse(stringifyGovernanceReport(report)) as typeof report;

    expect(parsed.requestedProfile).toBe('build');
    expect(parsed.requiredProfile).toBe('core');
    expect(parsed.finalProfile).toBe('core');
    expect(parsed.matchedScopes).toEqual(['a/path.ts', 'z/path.ts']);
    expect(parsed.routingSource).toBe('policy-registry');
    expect(parsed.projectsTouched).toEqual(['project-a', 'project-b']);
    expect(parsed.teamsTouched).toEqual(['team-a', 'team-b']);
    expect(parsed.warnings).toEqual(['a', 'b']);

    const ownershipDiagnostic = parsed.errors.find((entry) => entry.code === 'OWNERSHIP_VIOLATION');
    expect(ownershipDiagnostic?.severity).toBe('warning');
    expect(ownershipDiagnostic?.message).toContain('Ownership diagnostics');

    expect(parsed.errors.some((entry) => entry.code === 'MISSING_TIER_LABEL')).toBe(false);
    expect(parsed.errors.some((entry) => entry.code === 'MISSING_EVIDENCE_BLOCK')).toBe(false);
    expect(parsed.errors.some((entry) => entry.code === 'TIER_MISMATCH')).toBe(false);
  });
});
