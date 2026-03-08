import fs from 'node:fs';

import { extractTierFromLabels } from '../control-plane/governance/diagnostics.ts';
import { parseTierLine } from '../control-plane/governance/pr-body.ts';
import { fetchWithGitHubRetry } from '../control-plane/governance/github-retry.ts';
import { parsePullNumber, parseRepoRef, readPullNumberFromGitHubEvent } from '../control-plane/governance/pr-files-api.ts';

type ParsedArgs = {
  prNumber?: number;
};

type PullSummary = {
  body: string | null;
  labels: Array<{ name: string }>;
};

function parseArgs(argv: string[]): ParsedArgs {
  let prNumber: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      prNumber = parsePullNumber(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      prNumber = parsePullNumber(arg.slice('--pr='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { prNumber };
}

function resolveRequiredContext(args: ParsedArgs): {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
} {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN or GH_TOKEN environment variable.');
  }

  const repository = process.env.GITHUB_REPOSITORY ?? '';
  if (!repository) {
    throw new Error('Missing GITHUB_REPOSITORY environment variable.');
  }
  const { owner, repo } = parseRepoRef(repository);

  const pullNumber = args.prNumber
    ?? (process.env.GITHUB_EVENT_PATH ? readPullNumberFromGitHubEvent(process.env.GITHUB_EVENT_PATH) : null);
  if (!pullNumber) {
    throw new Error('Unable to resolve pull request number. Pass --pr <number> or set GITHUB_EVENT_PATH.');
  }

  return {
    token,
    owner,
    repo,
    pullNumber
  };
}

async function githubGet<T>(url: string, token: string): Promise<T> {
  const response = await fetchWithGitHubRetry(fetch, url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function githubPost(url: string, token: string, body: unknown): Promise<void> {
  const response = await fetchWithGitHubRetry(fetch, url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }
}

function writeOutput(entries: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  for (const [key, value] of Object.entries(entries).sort(([left], [right]) => left.localeCompare(right))) {
    fs.appendFileSync(outputPath, `${key}=${value}\n`);
  }
}

async function main(): Promise<void> {
  await runAutoApplyTierLabel(process.argv.slice(2));
}

export async function runAutoApplyTierLabel(argv: string[]): Promise<void> {
  try {
    const args = parseArgs(argv);
    const context = resolveRequiredContext(args);
    const pr = await githubGet<PullSummary>(
      `https://api.github.com/repos/${context.owner}/${context.repo}/pulls/${context.pullNumber}`,
      context.token
    );

    const labels = pr.labels.map((label) => label.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const existingTier = extractTierFromLabels(labels);
    const bodyTier = parseTierLine(pr.body ?? '');

    if (existingTier !== undefined) {
      process.stdout.write(`Tier label already present: tier-${existingTier}\n`);
      writeOutput({
        applied_label: 'false',
        detected_tier: `tier-${existingTier}`
      });
      return;
    }

    await githubPost(
      `https://api.github.com/repos/${context.owner}/${context.repo}/issues/${context.pullNumber}/labels`,
      context.token,
      { labels: [bodyTier] }
    );

    process.stdout.write(`Applied tier label from PR body: ${bodyTier}\n`);
    writeOutput({
      applied_label: 'true',
      detected_tier: bodyTier
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GitHub API error 403') || message.includes('Resource not accessible by integration')) {
      process.stderr.write(
        'Permission error: GitHub Actions token cannot apply labels. Ensure workflow permissions include contents: read, issues: write, pull-requests: write.\n'
      );
    }
    process.stderr.write(`${message}\n`);
    process.exitCode = message.includes('Missing GITHUB_TOKEN or GH_TOKEN') ? 2 : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
