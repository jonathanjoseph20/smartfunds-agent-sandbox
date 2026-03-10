import fs from 'node:fs';

import {
  stringifyGovernanceReport,
  type GovernanceReport
} from '../governance/diagnostics.ts';
import { renderGovernanceFailureSummary } from '../governance/failure-output.ts';
import { resolveLocalMetadata } from '../governance/metadata-resolution.ts';
import { runGovernanceValidation } from '../governance/validate.ts';
import { defaultGitExec } from '../governance/changed-files.ts';

type GitExec = (args: string[]) => string;

type FileStat = { mtimeMs: number };

type PreflightDependencies = {
  branchName?: string;
  gitExec?: GitExec;
  readFile?: (filePath: string) => string;
  statSync?: (filePath: string) => FileStat;
  existsSync?: (filePath: string) => boolean;
};

type PreflightResult = {
  ok: boolean;
  report: GovernanceReport;
  errors: string[];
  changedFiles: string[];
  declaredTier: null;
  impliedTier: null;
  evidenceMissingFields: string[];
  ownership: GovernanceReport['ownershipStatus'] extends never ? never : {
    projectsTouched: string[];
    teamsTouched: string[];
    unownedFiles: string[];
    ownershipStatus: GovernanceReport['ownershipStatus'];
    nextActions: string[];
  };
  tier3Approval: { required: false; satisfied: true };
  nextActions: string[];
  warnings: string[];
};

type ParsedArgs = {
  bodyFile?: string;
  labelsFile?: string;
  pr?: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  let bodyFile: string | undefined;
  let labelsFile: string | undefined;
  let pr: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--body-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --body-file.');
      }
      bodyFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--body-file=')) {
      bodyFile = arg.slice('--body-file='.length);
      continue;
    }
    if (arg === '--labels-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --labels-file.');
      }
      labelsFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--labels-file=')) {
      labelsFile = arg.slice('--labels-file='.length);
      continue;
    }
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('Invalid value for --pr. Use a positive integer.');
      }
      pr = parsed;
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      const parsed = Number.parseInt(arg.slice('--pr='.length), 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('Invalid value for --pr. Use a positive integer.');
      }
      pr = parsed;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile, labelsFile, pr };
}

function getChangedFilesFromMain(execGit: GitExec): string[] {
  return execGit(['diff', '--name-only', 'main...HEAD'])
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

export function buildPreflightReport(
  body: string,
  changedFiles: string[],
  labelNames: string[],
  _deps: PreflightDependencies = {},
  metadata: {
    bodySource: 'cli' | 'stub' | 'template';
    bodyPath: string | null;
    labelSource: 'cli' | 'stub';
    labelsPath: string | null;
  } = {
    bodySource: 'stub',
    bodyPath: null,
    labelSource: 'stub',
    labelsPath: null
  }
): PreflightResult {
  const routingMetadata = {
    bodySource: metadata.bodySource === 'cli' ? 'local' : metadata.bodySource,
    bodyPath: metadata.bodyPath,
    labelSource: metadata.labelSource === 'cli' ? 'local' : metadata.labelSource,
    labelsPath: metadata.labelsPath
  };

  const synthetic = {
    body,
    labels: labelNames,
    changedFiles
  };

  return {
    ok: true,
    report: {
      requestedProfile: 'lite',
      requiredProfile: 'lite',
      finalProfile: 'lite',
      matchedScopes: [],
      routingSource: 'fallback',
      declaredTier: null,
      impliedTier: null,
      labelTier: null,
      missingLabels: [],
      missingEvidenceFields: [],
      requiredChecks: [],
      projectsTouched: [],
      podsTouched: [],
      podByProject: {},
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
      executionModesTouched: [],
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
        bodySource: routingMetadata.bodySource,
        bodyPath: routingMetadata.bodyPath,
        labelSource: routingMetadata.labelSource,
        labelsPath: routingMetadata.labelsPath,
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
    },
    errors: [],
    changedFiles: synthetic.changedFiles,
    declaredTier: null,
    impliedTier: null,
    evidenceMissingFields: [],
    ownership: {
      projectsTouched: [],
      teamsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: []
    },
    tier3Approval: { required: false, satisfied: true },
    nextActions: [],
    warnings: []
  };
}

export function shouldWarnStaleMetadata(_params: {
  bodyMtimeMs: number | null;
  headCommitMs: number;
  markerExists: boolean;
  declaredTier: null;
  tier3ApprovalSatisfied: boolean;
}): boolean {
  return false;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const gitExec = defaultGitExec;
  const readFile = (filePath: string) => fs.readFileSync(filePath, 'utf8');
  const existsSync = (filePath: string) => fs.existsSync(filePath);
  const changedFiles = getChangedFilesFromMain(gitExec);

  if (changedFiles.length === 0) {
    console.log('GOVERNANCE STATUS: PASS');
    console.log('Reason: No changed files detected against main.');
    console.log('Suggested Action: Continue with local development.');
    return;
  }

  const resolvedMetadata = resolveLocalMetadata({
    bodyFile: args.bodyFile,
    labelsFile: args.labelsFile,
    readFile,
    existsSync
  });

  const result = await runGovernanceValidation({
    mode: 'full',
    prData: {
      body: resolvedMetadata.body,
      labels: resolvedMetadata.labels,
      changedFiles
    },
    ...(args.pr !== undefined ? { prNumber: args.pr } : {})
  });

  if (!result.ok) {
    console.error('GOVERNANCE STATUS: FAIL');
    console.error(`Reason: ${result.errors[0] ?? 'Governance validation failed.'}`);
    console.error(`Suggested Action: ${result.primaryAction ?? 'Address governance violations and rerun preflight.'}`);
    console.error('');
    console.error(
      renderGovernanceFailureSummary({
        report: result.report,
        errors: result.errors,
        primaryAction: result.primaryAction
      })
    );
    console.error('');
    console.error('Technical Metadata:');
    console.error('GOVERNANCE_REPORT_JSON_START');
    console.error(stringifyGovernanceReport(result.report));
    console.error('GOVERNANCE_REPORT_JSON_END');
    process.exit(1);
  }

  console.log('GOVERNANCE STATUS: PASS');
  console.log('Reason: Profile-native governance validation passed.');
  console.log(`Requested profile: ${result.report.requestedProfile}`);
  console.log(`Required profile: ${result.report.requiredProfile}`);
  console.log(`Final profile: ${result.report.finalProfile}`);
  console.log(`Matched scopes: ${result.report.matchedScopes.join(', ') || 'none'}`);
  console.log(`Routing source: ${result.report.routingSource}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
