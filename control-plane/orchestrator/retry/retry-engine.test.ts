import { describe, expect, it } from 'vitest';

import {
  buildDeterministicFixPlan,
  classifyRetriableGovernanceError,
  createInitialRetryState,
  evaluateRetryEligibility,
  extractGovernanceReportJson,
  parseGovernanceReport
} from './retry-engine.ts';
import type { GovernanceReport } from '../../governance/diagnostics.ts';

function baseReport(overrides: Partial<GovernanceReport> = {}): GovernanceReport {
  return {
    requestedProfile: 'core',
    requiredProfile: 'core',
    finalProfile: 'core',
    matchedScopes: [],
    routingSource: 'policy-registry',
    declaredTier: null,
    impliedTier: null,
    labelTier: null,
    missingLabels: [],
    missingEvidenceFields: [],
    requiredChecks: ['lint'],
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
    autonomousContextDetected: false,
    branchNamespaceValid: true,
    structuredPathsTouched: [],
    autonomousPathsTouched: [],
    isolationStatus: 'ok',
    isolationViolations: [],
    nextActions: [],
    warnings: [],
    executionModesTouched: ['autonomous'],
    modeBoundaryStatus: 'ok',
    conflictingTeams: [],
    conflictingPaths: [],
    swarmExecutionModesTouched: [],
    modeWarnings: [],
    unownedPaths: [],
    ambiguousPaths: [],
    modeEnforcementStatus: 'ok',
    modeViolation: null,
    requiredMinimumTier: null,
    errors: [],
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
      context: 'ci',
      executionMode: 'autonomous',
      retryEnabled: true
    },
    retryTrace: {
      attempted: false,
      retryCount: 0,
      initialStatus: 'failed',
      finalStatus: 'failed',
      triggerErrorCode: null,
      retryable: false,
      patchApplied: null
    },
    ...overrides
  };
}

describe('retry engine', () => {
  it('parses marked governance JSON output', () => {
    const raw = 'noise\nGOVERNANCE_REPORT_JSON_START\n{"errors":[]}\nGOVERNANCE_REPORT_JSON_END\n';
    expect(extractGovernanceReportJson(raw)).toBe('{"errors":[]}');
  });

  it('classifies unowned paths governance errors as retriable', () => {
    const report = baseReport({
      errors: [{
        code: 'UNOWNED_PATHS',
        severity: 'error',
        retryable: false,
        message: 'unowned',
        suggestedFix: null,
        sourceFields: ['unownedPaths']
      }]
    });

    expect(classifyRetriableGovernanceError(report)).toBe('UNOWNED_PATHS');
  });

  it('enforces mode restriction for structured mode', () => {
    const retryState = createInitialRetryState();
    const report = baseReport({
      errors: [{
        code: 'UNOWNED_PATHS',
        severity: 'error',
        retryable: false,
        message: 'unowned paths',
        suggestedFix: null,
        sourceFields: ['unownedPaths']
      }]
    });

    const decision = evaluateRetryEligibility({
      executionMode: 'structured',
      ciStatus: 'failed',
      retryState,
      governanceReport: report
    });

    expect(decision).toEqual({
      eligible: false,
      reason: 'structured_mode_disabled',
      triggerErrorCode: null
    });
  });

  it('enforces retry limit after one attempt', () => {
    const report = baseReport({
      errors: [{
        code: 'UNOWNED_PATHS',
        severity: 'error',
        retryable: false,
        message: 'unowned paths',
        suggestedFix: null,
        sourceFields: ['unownedPaths']
      }]
    });

    const decision = evaluateRetryEligibility({
      executionMode: 'autonomous',
      ciStatus: 'failed',
      retryState: {
        retryEnabled: true,
        retryCount: 1,
        retryAttempted: true,
        triggerErrorCode: 'MISSING_TIER_LABEL',
        finalStatus: 'failed_after_retry'
      },
      governanceReport: report
    });

    expect(decision.reason).toBe('retry_limit_reached');
  });

  it('builds deterministic fix plans', () => {
    const first = buildDeterministicFixPlan('UNOWNED_PATHS');
    const second = buildDeterministicFixPlan('UNOWNED_PATHS');

    expect(first).toEqual(second);
    expect(first).toEqual({
      errorCode: 'UNOWNED_PATHS',
      fix: 'ASSIGN_PROJECT_MAPPING'
    });
  });

  it('parses governance report payload with canonical error ordering', () => {
    const raw = [
      'GOVERNANCE_REPORT_JSON_START',
      JSON.stringify(baseReport({
        errors: [
          {
            code: 'UNOWNED_PATHS',
            severity: 'error',
            retryable: true,
            message: 'b',
            suggestedFix: null,
            sourceFields: []
          },
          {
            code: 'UNOWNED_PATHS',
            severity: 'error',
            retryable: true,
            message: 'a',
            suggestedFix: null,
            sourceFields: []
          }
        ]
      })),
      'GOVERNANCE_REPORT_JSON_END'
    ].join('\n');

    const report = parseGovernanceReport(raw);
    expect(report.errors.map((entry) => entry.message)).toEqual(['a', 'b']);
  });
});
