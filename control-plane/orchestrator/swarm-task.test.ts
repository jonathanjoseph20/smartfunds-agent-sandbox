import fs from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { spawnTask } from './swarm-task.ts';

type FakeCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type FakeDeps = {
  ciRollups: Array<Array<Record<string, unknown>>>;
  governanceOutput: string;
  callLog: Array<{ command: string; args: string[]; allowFailure: boolean }>;
};

function buildGovernanceOutput(params: {
  code: string;
  message: string;
  severity?: 'error' | 'warning';
  missingEvidenceFields?: string[];
}): string {
  return [
    'GOVERNANCE_REPORT_JSON_START',
    JSON.stringify({
      declaredTier: 2,
      impliedTier: 2,
      labelTier: 2,
      missingLabels: [],
      missingEvidenceFields: params.missingEvidenceFields ?? [],
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
      errors: [
        {
          code: params.code,
          severity: params.severity ?? 'error',
          retryable: true,
          message: params.message,
          suggestedFix: null,
          sourceFields: []
        }
      ],
      metadataSource: {
        bodySource: 'gh',
        bodyPath: null,
        labelSource: 'gh',
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
        retryable: true,
        patchApplied: null
      }
    }),
    'GOVERNANCE_REPORT_JSON_END'
  ].join('\n');
}

function governanceFailureRollup(code: string): Array<Record<string, unknown>> {
  return [{
    name: 'governance',
    conclusion: 'FAILURE',
    output: {
      summary: `errorCode: ${code}`
    }
  }];
}

function passedRollup(): Array<Record<string, unknown>> {
  return [{ name: 'lint_tier0', conclusion: 'SUCCESS' }];
}

function nonGovernanceFailureRollup(): Array<Record<string, unknown>> {
  return [{ name: 'unit_tests', conclusion: 'FAILURE' }];
}

function createFakeDeps(input: {
  ciRollups: Array<Array<Record<string, unknown>>>;
  governanceOutput: string;
}): { deps: FakeDeps; runCommand: (command: string, args: string[], allowFailure?: boolean) => FakeCommandResult } {
  const deps: FakeDeps = {
    ciRollups: [...input.ciRollups],
    governanceOutput: input.governanceOutput,
    callLog: []
  };

  const runCommand = (command: string, args: string[], allowFailure = false): FakeCommandResult => {
    deps.callLog.push({ command, args: [...args], allowFailure });

    if (command === 'npm' && args[0] === 'run' && args[1] === 'pr:create') {
      return {
        status: 0,
        stdout: 'PR updated and verified. URL: https://github.com/acme/repo/pull/41\nPR number: 41\nApplied labels: tier-2\n',
        stderr: ''
      };
    }

    if (command === 'gh' && args[0] === 'pr' && args[1] === 'view' && args.includes('statusCheckRollup')) {
      const rollup = deps.ciRollups.shift() ?? nonGovernanceFailureRollup();
      return {
        status: 0,
        stdout: JSON.stringify({ statusCheckRollup: rollup }),
        stderr: ''
      };
    }

    if (command === 'gh' && args[0] === 'pr' && args[1] === 'view' && args.includes('headRefOid')) {
      return {
        status: 0,
        stdout: JSON.stringify({ headRefOid: 'abc123' }),
        stderr: ''
      };
    }

    if (command === 'npm' && args[0] === 'run' && args[1] === 'governance:autonomous-retry') {
      return {
        status: 1,
        stdout: deps.governanceOutput,
        stderr: ''
      };
    }

    if (command === 'gh' && args[0] === 'pr' && args[1] === 'diff') {
      return {
        status: 0,
        stdout: 'control-plane/orchestrator/swarm-task.ts\n',
        stderr: ''
      };
    }

    if (command === 'gh' && args[0] === 'pr' && args[1] === 'view' && args.includes('--jq') && args.includes('.body')) {
      return {
        status: 0,
        stdout: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: x\nAffected Paths: x\nTests Added: x\nDeterminism Statement: x\n```\n',
        stderr: ''
      };
    }

    if (command === 'gh' && args[0] === 'pr' && args[1] === 'edit') {
      return {
        status: 0,
        stdout: '',
        stderr: ''
      };
    }

    if (command === 'git' && args[0] === 'commit') {
      return {
        status: 0,
        stdout: '',
        stderr: ''
      };
    }

    if (command === 'git' && args[0] === 'push') {
      return {
        status: 0,
        stdout: '',
        stderr: ''
      };
    }

    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };

  return { deps, runCommand };
}

afterEach(() => {
  fs.rmSync('.orchestrator', { recursive: true, force: true });
});

describe('swarm task orchestrator', () => {
  it('applies one deterministic fix on governance-retriable failure and passes', async () => {
    const { deps, runCommand } = createFakeDeps({
      ciRollups: [governanceFailureRollup('MISSING_TIER_LABEL'), passedRollup()],
      governanceOutput: buildGovernanceOutput({
        code: 'MISSING_TIER_LABEL',
        message: 'tier label missing'
      })
    });

    const result = await spawnTask({
      executionMode: 'autonomous',
      deps: { runCommand }
    });

    expect(result.retryState).toEqual({
      retryEnabled: true,
      retryCount: 1,
      retryAttempted: true,
      triggerErrorCode: 'MISSING_TIER_LABEL',
      finalStatus: 'passed'
    });

    expect(result.executionReport.retry.finalStatus).toBe('passed');
    expect(result.executionReportPath).toBe('.orchestrator/reports/pr-41/execution-report.v1.json');
    expect(deps.callLog.some((entry) =>
      entry.command === 'gh' &&
      entry.args[0] === 'pr' &&
      entry.args[1] === 'edit' &&
      entry.args.includes('--add-label')
    )).toBe(true);
  });

  it('fails after single retry when CI remains failed', async () => {
    const { runCommand } = createFakeDeps({
      ciRollups: [governanceFailureRollup('MISSING_TIER_LABEL'), governanceFailureRollup('MISSING_TIER_LABEL')],
      governanceOutput: buildGovernanceOutput({
        code: 'MISSING_TIER_LABEL',
        message: 'tier label missing'
      })
    });

    const result = await spawnTask({
      executionMode: 'autonomous',
      deps: { runCommand }
    });

    expect(result.retryState.finalStatus).toBe('failed_after_retry');
    expect(result.retryState.retryCount).toBe(1);
    expect(result.executionReport.retry.finalStatus).toBe('failed');
  });

  it('does not retry in structured mode', async () => {
    const { deps, runCommand } = createFakeDeps({
      ciRollups: [governanceFailureRollup('MISSING_TIER_LABEL')],
      governanceOutput: buildGovernanceOutput({
        code: 'MISSING_TIER_LABEL',
        message: 'tier label missing'
      })
    });

    const result = await spawnTask({
      executionMode: 'structured',
      deps: { runCommand }
    });

    expect(result.retryState).toEqual({
      retryEnabled: true,
      retryCount: 0,
      retryAttempted: false,
      triggerErrorCode: null,
      finalStatus: 'failed'
    });

    expect(result.executionReport.retry.ineligibleReason).toBe('MODE_NOT_AUTONOMOUS');
    expect(deps.callLog.some((entry) =>
      entry.command === 'gh' && entry.args[0] === 'pr' && entry.args[1] === 'edit'
    )).toBe(false);
  });

  it('does not retry non-governance CI failures', async () => {
    const { runCommand } = createFakeDeps({
      ciRollups: [nonGovernanceFailureRollup()],
      governanceOutput: 'not-json'
    });

    const result = await spawnTask({
      executionMode: 'autonomous',
      deps: { runCommand }
    });

    expect(result.retryState.retryAttempted).toBe(false);
    expect(result.retryState.finalStatus).toBe('failed');
    expect(result.executionReport.retry.ineligibleReason).toBe('NON_GOVERNANCE_GOVERNING_FAILURE');
  });
});
