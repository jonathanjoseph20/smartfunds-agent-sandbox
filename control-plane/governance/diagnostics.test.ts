import { describe, expect, it } from 'vitest';

import {
  buildGovernanceReport,
  stringifyGovernanceReport
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
        podsTouched: [],
        podByProject: {},
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
        autonomousContextDetected: true,
        branchNamespaceValid: false,
        structuredPathsTouched: ['control-plane/entities/rails.json', 'control-plane/governance/diagnostics.ts'],
        autonomousPathsTouched: ['docs/a.md', 'docs/z.md'],
        isolationStatus: 'autonomous_governance_core_mutation',
        isolationViolations: ['governance_core_mutation_attempt', 'structured_path_in_autonomous_context'],
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
        requiredMinimumTier: null,
        errors: [
          {
            code: 'MISSING_EVIDENCE_FIELDS',
            severity: 'error',
            retryable: true,
            message: 'Evidence is missing required field(s): Affected Paths, Tests Added.',
            suggestedFix: {
              action: 'update_evidence_file',
              details: 'Ensure governance/evidence.json exists and includes all required fields.'
            },
            sourceFields: ['missingEvidenceFields']
          },
          {
            code: 'MISSING_TIER_LABEL',
            severity: 'error',
            retryable: true,
            message: 'Missing required tier label.',
            suggestedFix: {
              action: 'add_tier_label',
              details: 'Add exactly one tier label matching the declared or implied tier.'
            },
            sourceFields: ['declaredTier', 'impliedTier', 'missingLabels']
          },
          {
            code: 'MIXED_MODE',
            severity: 'error',
            retryable: false,
            message: 'Mixed execution modes detected.',
            suggestedFix: {
              action: 'split_execution_modes',
              details: 'Split PR by execution mode or adjust declared mode boundaries.'
            },
            sourceFields: ['modeEnforcementStatus', 'modeViolation']
          },
          {
            code: 'OWNERSHIP_VIOLATION',
            severity: 'error',
            retryable: false,
            message: 'Ownership status is multi_project.',
            suggestedFix: {
              action: 'resolve_ownership',
              details: 'Address ownership diagnostics before retrying.'
            },
            sourceFields: ['ownershipStatus']
          },
          {
            code: 'RAIL_BINDING_VIOLATION',
            severity: 'error',
            retryable: false,
            message: 'Rail binding status is missing_rail_profile.',
            suggestedFix: {
              action: 'resolve_rail_binding',
              details: 'Resolve rail binding diagnostics for touched entities.'
            },
            sourceFields: ['railBindingStatus']
          },
          {
            code: 'SWARM_TOPOLOGY_VIOLATION',
            severity: 'error',
            retryable: false,
            message: 'Swarm orchestration status is violations.',
            suggestedFix: {
              action: 'repair_swarm_topology',
              details: 'Fix swarm orchestration registry and dependency topology.'
            },
            sourceFields: ['swarmOrchestrationStatus']
          },
          {
            code: 'TIER_MISMATCH',
            severity: 'error',
            retryable: false,
            message: 'Declared tier-2 is below implied tier-3.',
            suggestedFix: {
              action: 'align_tier',
              details: 'Raise declared tier and align metadata with implied tier.'
            },
            sourceFields: ['declaredTier', 'impliedTier']
          },
          {
            code: 'UNOWNED_PATHS',
            severity: 'warning',
            retryable: false,
            message: 'Unowned paths detected: scripts/a.ts, scripts/z.ts.',
            suggestedFix: {
              action: 'assign_paths',
              details: 'Map unowned paths to owning teams or projects.'
            },
            sourceFields: ['unownedPaths']
          }
        ],
        metadataSource: {
          bodySource: 'stub',
          bodyPath: null,
          labelSource: 'stub',
          labelsPath: null,
          commentSource: 'none'
        },
        commentEvidenceDetected: false,
        commentEvidenceCount: 0,
        sealWarnings: [],
        executionContext: {
          context: 'local',
          executionMode: 'unknown',
          retryEnabled: false
        },
        retryTrace: {
          attempted: false,
          retryCount: 0,
          initialStatus: 'passed',
          finalStatus: 'passed',
          triggerErrorCode: null,
          retryable: false,
          patchApplied: null
        }
      })
    );
  });
});
