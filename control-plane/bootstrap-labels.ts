import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { pathToFileURL } from 'node:url';

type LabelSpec = {
  name: string;
  color: string;
  description: string;
};

type ExistingLabel = {
  name: string;
  color: string;
  description: string | null;
};

type Summary = {
  created: string[];
  updated: string[];
  unchanged: string[];
};

type EnsureOptions = {
  repo?: string;
  token?: string;
  dryRun?: boolean;
  yes?: boolean;
  fetchImpl?: typeof fetch;
  requiredLabels?: LabelSpec[];
};

class ExitError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

const DEFAULT_REQUIRED_LABELS: LabelSpec[] = [
  { name: 'tier-0', color: 'ededed', description: 'Cosmetic / docs-only' },
  { name: 'tier-1', color: '0e8a16', description: 'Low risk change' },
  { name: 'tier-2', color: 'fbca04', description: 'Medium risk change' },
  { name: 'tier-3', color: 'b60205', description: 'High risk / control-plane' },
  { name: 'tier-3-approved', color: '5319e7', description: 'Tier 3 approval recorded' },
  { name: 'codex', color: '1d76db', description: 'Codex-assisted change' }
];

const DEFAULT_PER_PAGE = 100;

function normalizeColor(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeDescription(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function parseRepo(value: string): { owner: string; repo: string } {
  const [owner, repo] = value.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repo value: ${value}. Expected owner/name.`);
  }
  return { owner, repo };
}

function parseArgs(argv: string[]): { repo?: string; dryRun: boolean; yes: boolean } {
  let repo: string | undefined;
  let dryRun = false;
  let yes = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--yes') {
      yes = true;
      continue;
    }
    if (arg === '--repo') {
      repo = argv[index + 1];
      if (!repo) {
        throw new Error('Missing value for --repo.');
      }
      index += 1;
      continue;
    }
    if (arg.startsWith('--repo=')) {
      repo = arg.slice('--repo='.length);
      if (!repo) {
        throw new Error('Missing value for --repo.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { repo, dryRun, yes };
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  options: RequestInit
): Promise<T> {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function listLabels(
  fetchImpl: typeof fetch,
  owner: string,
  repo: string,
  token: string
): Promise<ExistingLabel[]> {
  const labels: ExistingLabel[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=${DEFAULT_PER_PAGE}&page=${page}`;
    const pageLabels = await requestJson<ExistingLabel[]>(fetchImpl, url, token, { method: 'GET' });
    labels.push(...pageLabels);
    if (pageLabels.length < DEFAULT_PER_PAGE) {
      break;
    }
    page += 1;
  }

  return labels;
}

async function createLabel(
  fetchImpl: typeof fetch,
  owner: string,
  repo: string,
  token: string,
  label: LabelSpec
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/labels`;
  await requestJson(fetchImpl, url, token, {
    method: 'POST',
    body: JSON.stringify({
      name: label.name,
      color: label.color,
      description: label.description
    })
  });
}

async function updateLabel(
  fetchImpl: typeof fetch,
  owner: string,
  repo: string,
  token: string,
  label: LabelSpec
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(label.name)}`;
  await requestJson(fetchImpl, url, token, {
    method: 'PATCH',
    body: JSON.stringify({
      name: label.name,
      color: label.color,
      description: label.description
    })
  });
}

function needsUpdate(existing: ExistingLabel, desired: LabelSpec): boolean {
  return (
    normalizeColor(existing.color) !== normalizeColor(desired.color) ||
    normalizeDescription(existing.description) !== normalizeDescription(desired.description)
  );
}

async function confirmProceed(message: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  const answer: string = await new Promise((resolve) => {
    rl.question(message, (value) => resolve(value.trim()));
  });
  rl.close();

  return ['y', 'yes'].includes(answer.toLowerCase());
}

export async function ensureLabels(options: EnsureOptions): Promise<Summary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requiredLabels = options.requiredLabels ?? DEFAULT_REQUIRED_LABELS;
  const repoValue = options.repo ?? process.env.GITHUB_REPOSITORY;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const dryRun = options.dryRun ?? false;
  const yes = options.yes ?? false;

  if (!token) {
    throw new ExitError('Missing GITHUB_TOKEN or GH_TOKEN environment variable.', 2);
  }
  if (!repoValue) {
    throw new Error('Missing --repo and GITHUB_REPOSITORY is not set.');
  }

  const { owner, repo } = parseRepo(repoValue);

  if (!dryRun && !yes) {
    const confirmed = await confirmProceed(
      `This will update labels in ${owner}/${repo}. Continue? (y/N): `
    );
    if (!confirmed) {
      return { created: [], updated: [], unchanged: [] };
    }
  }

  const existingLabels = await listLabels(fetchImpl, owner, repo, token);
  const existingByName = new Map(existingLabels.map((label) => [label.name, label]));

  const summary: Summary = { created: [], updated: [], unchanged: [] };
  const toCreate: LabelSpec[] = [];
  const toUpdate: LabelSpec[] = [];

  for (const label of requiredLabels) {
    const existing = existingByName.get(label.name);
    if (!existing) {
      summary.created.push(label.name);
      toCreate.push(label);
      continue;
    }
    if (needsUpdate(existing, label)) {
      summary.updated.push(label.name);
      toUpdate.push(label);
    } else {
      summary.unchanged.push(label.name);
    }
  }

  if (!dryRun) {
    for (const label of toCreate) {
      await createLabel(fetchImpl, owner, repo, token, label);
    }
    for (const label of toUpdate) {
      await updateLabel(fetchImpl, owner, repo, token, label);
    }
  }

  return summary;
}

function printSummary(summary: Summary, dryRun: boolean): void {
  const prefix = dryRun ? 'dry-run: ' : '';
  const formatList = (values: string[]) => (values.length === 0 ? 'none' : values.join(', '));
  output.write(`${prefix}created: ${formatList(summary.created)}\n`);
  output.write(`${prefix}updated: ${formatList(summary.updated)}\n`);
  output.write(`${prefix}unchanged: ${formatList(summary.unchanged)}\n`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const summary = await ensureLabels({
      repo: args.repo,
      dryRun: args.dryRun,
      yes: args.yes
    });
    printSummary(summary, args.dryRun);
  } catch (error) {
    const exitError = error instanceof ExitError ? error : undefined;
    const message = error instanceof Error ? error.message : String(error);
    output.write(`${message}\n`);
    process.exitCode = exitError?.exitCode ?? 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

export const REQUIRED_LABELS = DEFAULT_REQUIRED_LABELS;
export const parseCliArgs = parseArgs;
