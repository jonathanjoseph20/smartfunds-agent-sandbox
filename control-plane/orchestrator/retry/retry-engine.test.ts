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
    declaredTier: 2,
    impliedTier: 2,
    labelTier: 2,
    missingLabels: [],
    missingEvidenceFields: [],
    requiredChecks: ['lint_tier0'],
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

  it('classifies retriable governance error deterministically', () => {
    const report = baseReport({
      missingEvidenceFields: ['Risk Tier'],
      errors: [{
        code: 'MISSING_EVIDENCE_FIELDS',
        severity: 'error',
        retryable: true,
        message: 'missing',
        suggestedFix: null,
        sourceFields: ['missingEvidenceFields']
      }]
    });

    expect(classifyRetriableGovernanceError(report)).toBe('MISSING_EVIDENCE_FIELD');
  });

  it('enforces mode restriction for structured mode', () => {
    const retryState = createInitialRetryState();
    const report = baseReport({
      errors: [{
        code: 'MISSING_TIER_LABEL',
        severity: 'error',
        retryable: true,
        message: 'tier label missing',
        suggestedFix: null,
        sourceFields: ['missingLabels']
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
        code: 'MISSING_TIER_LABEL',
        severity: 'error',
        retryable: true,
        message: 'tier label missing',
        suggestedFix: null,
        sourceFields: ['missingLabels']
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
    const first = buildDeterministicFixPlan('INVALID_BODY_FORMAT');
    const second = buildDeterministicFixPlan('INVALID_BODY_FORMAT');

    expect(first).toEqual(second);
    expect(first).toEqual({
      errorCode: 'INVALID_BODY_FORMAT',
      fix: 'NORMALIZE_BODY'
    });
  });

  it('parses governance report payload with canonical error ordering', () => {
    const raw = [
      'GOVERNANCE_REPORT_JSON_START',
      JSON.stringify(baseReport({
        errors: [
          {
            code: 'MISSING_TIER_LABEL',
            severity: 'error',
            retryable: true,
            message: 'b',
            suggestedFix: null,
            sourceFields: []
          },
          {
            code: 'MISSING_TIER_LABEL',
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
