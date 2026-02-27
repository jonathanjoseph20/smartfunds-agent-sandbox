import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

import type { GovernanceReport, GovernanceErrorCode } from '../diagnostics.ts';
import { buildPreflightReport } from '../../cli/governance-preflight.ts';
import { patchPrBody } from './pr-body-patcher.ts';
import { selectRetryAction } from './retry-policy.ts';
import {
  buildRetryTriggerContent,
  hasReachedRetryLimit,
  loadRetryState,
  saveRetryState,
  updateRetryStateForAppliedAction
} from './retry-state.ts';
import type { RetryPlan, RetryRunOptions } from './types.ts';

const RETRY_STATE_PATH = 'control-plane/governance/retry-state.json';
const RETRY_TRIGGER_PATH = 'control-plane/governance/retry-trigger.txt';
const RETRY_BODY_TMP_PATH = 'control-plane/governance/.retry-body.tmp.md';
const PREFLIGHT_JSON_START = 'GOVERNANCE_REPORT_JSON_START';
const PREFLIGHT_JSON_END = 'GOVERNANCE_REPORT_JSON_END';

type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type RetryRunResult = {
  exitCode: number;
  summary: RetryPlan;
};

function runCommand(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Failed to execute command: ${command} (${result.error.message})`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Unable to parse governance JSON report.');
  }
}

function extractReportJson(preflightOutput: string): string {
  const start = preflightOutput.indexOf(PREFLIGHT_JSON_START);
  const end = preflightOutput.indexOf(PREFLIGHT_JSON_END);

  if (start >= 0 && end > start) {
    const section = preflightOutput.slice(start + PREFLIGHT_JSON_START.length, end).trim();
    if (section.startsWith('{') && section.endsWith('}')) {
      return section;
    }
  }

  const firstBrace = preflightOutput.indexOf('{');
  const lastBrace = preflightOutput.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return preflightOutput.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('Governance report JSON not found in preflight output.');
}

function parsePreflightReport(preflightOutput: string): GovernanceReport {
  const rawJson = extractReportJson(preflightOutput);
  const parsed = parseJsonObject(rawJson) as GovernanceReport;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.errors)) {
    throw new Error('Invalid governance report: missing canonical errors[] field.');
  }
  return parsed;
}

function runPreflightFallback(): GovernanceReport {
  const body = fs.existsSync('.pr-body.md') ? fs.readFileSync('.pr-body.md', 'utf8') : '';
  const labels = fs.existsSync('.pr-labels.txt')
    ? fs
        .readFileSync('.pr-labels.txt', 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  return buildPreflightReport(body, [], labels).report;
}

function resolvePrNumber(explicitPr?: number): number {
  if (typeof explicitPr === 'number') {
    return explicitPr;
  }

  const result = runCommand('gh', ['pr', 'view', '--json', 'number', '--jq', '.number']);
  if (result.status !== 0) {
    throw new Error('Unable to resolve PR number. Pass --pr <number> or run inside a PR checkout.');
  }
  const value = Number.parseInt(result.stdout.trim(), 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error('Unable to resolve PR number from gh context.');
  }
  return value;
}

function resolveTier(report: GovernanceReport): number | null {
  const preferred = report.declaredTier;
  const implied = report.impliedTier;
  const tier = typeof preferred === 'number' ? preferred : implied;
  if (tier === 0 || tier === 1 || tier === 2 || tier === 3) {
    return tier;
  }
  return null;
}

function getCurrentPrLabels(pr: number): string[] {
  const result = runCommand('gh', ['pr', 'view', String(pr), '--json', 'labels', '--jq', '.labels[].name']);
  if (result.status !== 0) {
    throw new Error(`Unable to fetch labels for PR ${pr}.`);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getCurrentPrBody(pr: number): string {
  const result = runCommand('gh', ['pr', 'view', String(pr), '--json', 'body', '--jq', '.body']);
  if (result.status !== 0) {
    throw new Error(`Unable to fetch body for PR ${pr}.`);
  }
  return result.stdout.replace(/\n$/, '');
}

function addLabel(pr: number, label: string): void {
  const result = runCommand('gh', ['pr', 'edit', String(pr), '--add-label', label]);
  if (result.status !== 0) {
    throw new Error(`Unable to add label ${label} to PR ${pr}.`);
  }
}

function updatePrBody(pr: number, body: string): void {
  fs.writeFileSync(RETRY_BODY_TMP_PATH, `${body}\n`);
  const result = runCommand('gh', ['pr', 'edit', String(pr), '--body-file', RETRY_BODY_TMP_PATH]);
  fs.rmSync(RETRY_BODY_TMP_PATH, { force: true });
  if (result.status !== 0) {
    throw new Error(`Unable to update PR body for PR ${pr}.`);
  }
}

function createTriggerCommit(pr: number, attempt: number): void {
  fs.writeFileSync(RETRY_TRIGGER_PATH, `${buildRetryTriggerContent(pr, attempt)}\n`);
  const addResult = runCommand('git', ['add', RETRY_TRIGGER_PATH, RETRY_STATE_PATH]);
  if (addResult.status !== 0) {
    throw new Error('Unable to stage retry trigger and retry state files.');
  }
  const commitMessage = `chore: retry loop trigger (pr ${pr} attempt ${attempt})`;
  const commitResult = runCommand('git', ['commit', '-m', commitMessage]);
  if (commitResult.status !== 0) {
    throw new Error('Unable to create retry trigger commit.');
  }
  const pushResult = runCommand('git', ['push']);
  if (pushResult.status !== 0) {
    throw new Error('Unable to push retry trigger commit.');
  }
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function runRetryLoop(options: RetryRunOptions): RetryRunResult {
  const pr = resolvePrNumber(options.pr);
  const state = loadRetryState(RETRY_STATE_PATH);
  const previousAttempts = hasReachedRetryLimit(state, pr) ? 1 : 0;
  const attempt = previousAttempts + 1;

  if (hasReachedRetryLimit(state, pr)) {
    return {
      exitCode: 0,
      summary: {
        pr,
        attempt: 1,
        status: 'already-attempted',
        selectedActionCode: null,
        appliedChanges: {
          labelsAdded: [],
          bodyPatched: false,
          triggerCommitCreated: false
        },
        refusalReason: null
      }
    };
  }

  let report: GovernanceReport;
  try {
    const preflight = runCommand(process.execPath, ['--experimental-strip-types', 'control-plane/cli/governance-preflight.ts']);
    report = parsePreflightReport(`${preflight.stdout}\n${preflight.stderr}`);
  } catch (error) {
    const message = (error as Error).message;
    if (options.dryRun && message.includes('EPERM')) {
      report = runPreflightFallback();
    } else {
      throw error;
    }
  }
  const selection = selectRetryAction(report.errors);

  if (selection.status === 'no-blocking') {
    return {
      exitCode: 0,
      summary: {
        pr,
        attempt,
        status: 'noop',
        selectedActionCode: null,
        appliedChanges: {
          labelsAdded: [],
          bodyPatched: false,
          triggerCommitCreated: false
        },
        refusalReason: null
      }
    };
  }

  if (selection.status === 'unsupported') {
    return {
      exitCode: 1,
      summary: {
        pr,
        attempt,
        status: 'unsupported',
        selectedActionCode: null,
        appliedChanges: {
          labelsAdded: [],
          bodyPatched: false,
          triggerCommitCreated: false
        },
        refusalReason: `Unsupported blocking errors: ${selection.unsupportedBlockingCodes.join(', ')}`
      }
    };
  }

  const tier = resolveTier(report);
  if (tier === null) {
    return {
      exitCode: 1,
      summary: {
        pr,
        attempt,
        status: 'unsupported',
        selectedActionCode: selection.code,
        appliedChanges: {
          labelsAdded: [],
          bodyPatched: false,
          triggerCommitCreated: false
        },
        refusalReason: 'Unable to determine tier for retry remediation.'
      }
    };
  }

  const labelsAdded: string[] = [];
  let bodyPatched = false;

  if (selection.category === 'labels') {
    const existingLabels = getCurrentPrLabels(pr);
    const requiredLabels = [`tier-${tier}`, ...(tier === 3 ? ['tier-3-approved'] : [])].sort((a, b) =>
      a.localeCompare(b)
    );
    const missing = requiredLabels.filter((label) => !existingLabels.includes(label));
    labelsAdded.push(...missing);

    if (!options.dryRun) {
      for (const label of missing) {
        addLabel(pr, label);
      }
    }
  }

  if (selection.category === 'body') {
    const body = getCurrentPrBody(pr);
    const patchResult = patchPrBody(body, tier);
    bodyPatched = patchResult.changed;

    if (patchResult.changed && !options.dryRun) {
      updatePrBody(pr, patchResult.patchedBody);
    }
  }

  const appliedMetadataChange = labelsAdded.length > 0 || bodyPatched;
  let triggerCommitCreated = false;

  if (appliedMetadataChange && !options.dryRun) {
    const nextState = updateRetryStateForAppliedAction({
      state,
      pr,
      actionCodes: [selection.code as GovernanceErrorCode],
      lastCommitSha: ''
    });
    saveRetryState(RETRY_STATE_PATH, nextState);
    createTriggerCommit(pr, attempt);
    triggerCommitCreated = true;
  }

  return {
    exitCode: 0,
    summary: {
      pr,
      attempt,
      status: appliedMetadataChange ? 'applied' : 'noop',
      selectedActionCode: selection.code,
      appliedChanges: {
        labelsAdded: uniqueSorted(labelsAdded),
        bodyPatched,
        triggerCommitCreated
      },
      refusalReason: null
    }
  };
}
