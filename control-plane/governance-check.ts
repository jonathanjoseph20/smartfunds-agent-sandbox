import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  buildBootstrapActions,
  buildEvidenceBlockAction,
  buildGovernanceReport,
  buildStalePayloadActions,
  extractTierLabelFromBody,
  extractTierFromEvidence,
  getRequiredChecksForTier,
  inferImpliedTier,
  loadRiskContract,
  resolveDeclaredTier,
  selectPrimaryAction,
  stringifyGovernanceReport,
  validateEvidenceBlockSchema,
  type GovernanceReport,
  type Tier
} from './governance/diagnostics';
import { REQUIRED_LABELS } from './bootstrap-labels';

type GitExec = (args: string[]) => string;

type GovernanceCheckOptions = {
  bodyFile?: string;
  repo?: string;
  token?: string;
  gitExec?: GitExec;
  readFile?: (filePath: string) => string;
  fetchImpl?: typeof fetch;
};

type LabelInfo = {
  name: string;
};

const DEFAULT_BODY_FILE = '.github/pull_request_template.md';

function defaultGitExec(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseArgs(argv: string[]): { bodyFile: string } {
  let bodyFile = DEFAULT_BODY_FILE;

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
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile };
}

function resolveMergeBase(execGit: GitExec): string {
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

function collectChangedFiles(execGit: GitExec, baseSha: string): string[] {
  const output = execGit(['diff', '--name-only', baseSha, 'HEAD']);
  if (!output) {
    return [];
  }
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function fetchRepoLabels(fetchImpl: typeof fetch, repo: string, token: string): Promise<string[]> {
  const labels: string[] = [];
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo value: ${repo}. Expected owner/name.`);
  }
  let page = 1;

  while (true) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${name}/labels?per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${message}`);
    }

    const pageLabels = (await response.json()) as LabelInfo[];
    labels.push(...pageLabels.map((label) => label.name));

    if (pageLabels.length < 100) {
      break;
    }
    page += 1;
  }

  return labels;
}

function buildWarnings(hasLabelCheck: boolean): string[] {
  const warnings: string[] = [];
  if (!hasLabelCheck) {
    warnings.push(
      'Label existence not verified in local mode. Provide GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY to check labels, or run label bootstrap in dry-run.'
    );
  }
  warnings.push('Labels are authoritative in CI; local mode assumes label tier from the PR body.');
  return warnings;
}

function buildNextActions(
  declaredTier: Tier | null,
  impliedTier: Tier,
  evidenceErrors: string[],
  missingEvidenceFields: string[],
  tierBodyLabel: Tier | undefined,
  tierBody: Tier | undefined,
  repo?: string,
  missingRepoLabels: string[] = []
): string[] {
  const actions: string[] = [];

  if (!tierBodyLabel) {
    actions.push('Add unfenced PR body tier declaration (tier-0..tier-3).');
  }

  if (missingEvidenceFields.length > 0 || evidenceErrors.length > 0) {
    actions.push(buildEvidenceBlockAction());
  }

  if (tierBody !== undefined && tierBodyLabel !== undefined && tierBody !== tierBodyLabel) {
    actions.push(`Update PR body evidence Risk Tier to ${tierBodyLabel}.`);
  }

  if (declaredTier !== null && declaredTier < impliedTier) {
    actions.push(`Update PR body Risk Tier to ${impliedTier} and apply matching tier label.`);
  }

  if (declaredTier === 3) {
    actions.push('Add label: tier-3-approved.');
  }

  if (missingRepoLabels.length > 0) {
    actions.push(...buildBootstrapActions(repo));
  }

  return actions;
}

export async function runGovernanceCheck(options: GovernanceCheckOptions = {}): Promise<{
  ok: boolean;
  report: GovernanceReport;
  errors: string[];
}> {
  const gitExec = options.gitExec ?? defaultGitExec;
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  const fetchImpl = options.fetchImpl ?? fetch;
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  const bodyFile = options.bodyFile ?? DEFAULT_BODY_FILE;
  const resolvedBodyPath = path.resolve(bodyFile);
  const body = readFile(resolvedBodyPath);

  const contract = loadRiskContract(path.resolve('control-plane/risk-contract.json'));
  const baseSha = resolveMergeBase(gitExec);
  const changedFiles = collectChangedFiles(gitExec, baseSha);

  const evidenceValidation = validateEvidenceBlockSchema(body);
  const evidenceErrors = [...evidenceValidation.errors];
  const missingEvidenceFields = evidenceValidation.missingFields;
  const errors: string[] = [...evidenceErrors];

  let tierBodyLabel: Tier | undefined;
  try {
    tierBodyLabel = extractTierLabelFromBody(body);
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (tierBodyLabel === undefined) {
    errors.push('Missing unfenced PR body tier declaration. Include exactly one plain-text `tier-0`..`tier-3` in the PR body.');
  }

  const tierBody = extractTierFromEvidence(body);
  if (evidenceValidation.evidence && tierBody === undefined) {
    errors.push('Evidence block must include `Risk Tier: <0|1|2|3>`.');
  }

  if (tierBody !== undefined && tierBodyLabel !== undefined && tierBody !== tierBodyLabel) {
    errors.push(
      `Risk tier mismatch: PR body evidence Risk Tier is ${tierBody}; update to match unfenced tier-${tierBodyLabel}.`
    );
  }

  const { impliedTier } = inferImpliedTier(changedFiles, contract);
  const declaredTier = resolveDeclaredTier({ tierBody, tierBodyLabel });
  const labelTier = declaredTier;

  if (labelTier !== null && labelTier < impliedTier) {
    errors.push(`Declared tier-${labelTier} is below implied tier-${impliedTier}.`);
  }

  const requiredChecks = labelTier !== null ? getRequiredChecksForTier(labelTier, contract) : [];

  let missingRepoLabels: string[] = [];
  let hasLabelCheck = false;
  if (token && repo) {
    const labelNames = await fetchRepoLabels(fetchImpl, repo, token);
    const requiredLabelNames = REQUIRED_LABELS.map((label) => label.name);
    const labelSet = new Set(labelNames);
    missingRepoLabels = requiredLabelNames.filter((label) => !labelSet.has(label));
    hasLabelCheck = true;
  }

  const warnings = buildWarnings(hasLabelCheck);
  const nextActions = buildNextActions(
    declaredTier,
    impliedTier,
    evidenceErrors,
    missingEvidenceFields,
    tierBodyLabel,
    tierBody,
    repo,
    missingRepoLabels
  );

  if (errors.length > 0) {
    warnings.push(
      'If you updated PR body/labels after a failed run, push a new commit to refresh the PR payload before re-running.'
    );
    nextActions.push(...buildStalePayloadActions());
  }

  const report = buildGovernanceReport({
    declaredTier,
    impliedTier,
    labelTier,
    missingLabels: missingRepoLabels,
    missingEvidenceFields,
    requiredChecks,
    nextActions,
    warnings
  });

  return {
    ok: errors.length === 0,
    report,
    errors
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { ok, report, errors } = await runGovernanceCheck({ bodyFile: args.bodyFile });
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  const primaryAction = selectPrimaryAction(report.nextActions);

  console.log(`Governance preflight ${status}.`);
  console.log(`Declared Tier: ${report.declaredTier ?? 'n/a'}`);
  console.log(`Label Tier: ${report.labelTier ?? 'n/a'}`);
  console.log(`Implied Tier: ${report.impliedTier ?? 'n/a'}`);
  console.log(`Fix: ${primaryAction ?? 'None'}`);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
  }

  console.log('GOVERNANCE_REPORT_JSON_START');
  console.log(stringifyGovernanceReport(report));
  console.log('GOVERNANCE_REPORT_JSON_END');

  if (!ok) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs, resolveMergeBase, collectChangedFiles };
