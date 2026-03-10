import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { stringifyGovernanceReport, type GovernanceReport } from './governance/diagnostics.ts';
import { resolveLocalMetadata } from './governance/metadata-resolution.ts';
import { renderGovernanceFailureSummary } from './governance/failure-output.ts';
import { runGovernanceValidation } from './governance/validate.ts';
import { classifyIsolation, type ClassifyIsolationArgs } from './isolation/path-classifier.ts';
import type { IsolationClassification } from './isolation/types.ts';

export const ISOLATION_REMEDIATION_ACTION =
  'Autonomous contexts (swarm/*) must not touch structured paths; move change to structured branch or restrict task to autonomous paths.';

function getChangedFilesFromBase(execGit: (args: string[]) => string, baseSha: string): string[] {
  return execGit(['diff', '--name-only', `${baseSha}...HEAD`])
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function defaultGitExec(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseArgs(argv: string[]): { bodyFile?: string; labelsFile?: string } {
  let bodyFile: string | undefined;
  let labelsFile: string | undefined;

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
      if (!bodyFile) {
        throw new Error('Missing value for --body-file.');
      }
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
      if (!labelsFile) {
        throw new Error('Missing value for --labels-file.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile, labelsFile };
}

function resolveMergeBase(execGit: (args: string[]) => string): string {
  const candidates = ['upstream/main', 'origin/main', 'main'];
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return execGit(['merge-base', 'HEAD', candidate]);
    } catch (error) {
      errors.push(`${candidate}: ${(error as Error).message}`);
    }
  }

  throw new Error(`Unable to resolve merge-base against ${candidates.join(', ')}. ${errors.join(' | ')}`);
}

export function collectChangedFiles(execGit: (args: string[]) => string, baseSha: string): string[] {
  return getChangedFilesFromBase(execGit, baseSha);
}

function buildIsolationErrorMessage(classification: IsolationClassification): string {
  const statusCode = `isolation_violation:${classification.isolationStatus}`;
  if (classification.isolationStatus === 'invalid_autonomous_branch_namespace') {
    return `${statusCode}: swarm branch must match swarm/<task> where <task> is [a-z0-9._-]+.`;
  }

  const structuredPaths = [...new Set(classification.structuredPathsTouched)].sort((a, b) => a.localeCompare(b));
  return `${statusCode}: autonomous context may not modify structured paths: ${structuredPaths.join(', ')}`;
}

export function buildIsolationEnforcement(args: {
  branchName: string;
  changedFiles: string[];
  executionMode: 'structured' | 'autonomous' | 'unknown';
}): {
  classification: IsolationClassification;
  errors: string[];
  nextActions: string[];
} {
  const classifyArgs: ClassifyIsolationArgs = {
    branchName: args.branchName,
    changedFiles: args.changedFiles,
    executionMode: args.executionMode
  };
  const classification = classifyIsolation(classifyArgs);

  if (!classification.autonomousContextDetected || classification.isolationStatus === 'ok') {
    return {
      classification,
      errors: [],
      nextActions: []
    };
  }

  return {
    classification,
    errors: [buildIsolationErrorMessage(classification)],
    nextActions: [ISOLATION_REMEDIATION_ACTION]
  };
}

export async function runGovernanceCheck(options: {
  bodyFile?: string;
  labelsFile?: string;
  gitExec?: (args: string[]) => string;
  readFile?: (filePath: string) => string;
  existsSync?: (filePath: string) => boolean;
} = {}): Promise<{
  ok: boolean;
  report: GovernanceReport;
  errors: string[];
}> {
  const gitExec = options.gitExec ?? defaultGitExec;
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  const existsSync = options.existsSync ?? ((filePath: string) => fs.existsSync(filePath));
  const baseSha = resolveMergeBase(gitExec);
  const changedFiles = collectChangedFiles(gitExec, baseSha);
  const resolvedMetadata = resolveLocalMetadata({
    bodyFile: options.bodyFile,
    labelsFile: options.labelsFile,
    readFile,
    existsSync
  });

  const result = await runGovernanceValidation({
    mode: 'full',
    prData: {
      body: resolvedMetadata.body,
      labels: resolvedMetadata.labels,
      changedFiles
    }
  });

  return {
    ok: result.ok,
    report: result.report,
    errors: result.errors
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { ok, report, errors } = await runGovernanceCheck({ bodyFile: args.bodyFile, labelsFile: args.labelsFile });
  const primaryAction = report.nextActions[0] ?? null;

  if (!ok) {
    console.error('Governance preflight FAIL.');
    console.error(`Primary violation: ${errors[0] ?? 'Governance validation failed.'}`);
    console.error('');
    console.error(
      renderGovernanceFailureSummary({
        report,
        errors,
        primaryAction
      })
    );
    console.error('');
    console.error('GOVERNANCE_REPORT_JSON_START');
    console.error(stringifyGovernanceReport(report));
    console.error('GOVERNANCE_REPORT_JSON_END');
    process.exit(1);
  }

  console.log('Governance preflight PASS.');
  console.log(`Requested profile: ${report.requestedProfile}`);
  console.log(`Required profile: ${report.requiredProfile}`);
  console.log(`Final profile: ${report.finalProfile}`);
  console.log(`Matched scopes: ${report.matchedScopes.join(', ') || 'none'}`);
  console.log(`Routing source: ${report.routingSource}`);
  console.log('GOVERNANCE_REPORT_JSON_START');
  console.log(stringifyGovernanceReport(report));
  console.log('GOVERNANCE_REPORT_JSON_END');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { defaultGitExec, parseArgs, resolveMergeBase };
