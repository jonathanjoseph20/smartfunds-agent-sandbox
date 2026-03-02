import fs from 'node:fs';

import { defaultGitExec, getChangedFilesFromMain, normalizeChangedFiles, type GitExec } from './changed-files.ts';

export type RepoRef = { owner: string; repo: string };

export type PullRequestMetadata = {
  pullNumber: number;
  body: string;
  labels: string[];
  changedFiles: string[];
  source: 'api' | 'event-fallback';
  warnings: string[];
};

export type PullRequestMetadataOptions = {
  token?: string;
  repository?: string;
  eventPath?: string;
  pullNumber?: number;
  fetchImpl?: typeof fetch;
  gitExec?: GitExec;
  requireApi?: boolean;
};

type GitHubPullRequestPayload = {
  body: string | null;
  labels: Array<{ name: string }>;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function parseRepoRef(repoFull: string): RepoRef {
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: "${repoFull}" (expected "owner/repo")`);
  }
  return { owner, repo };
}

export function parsePullNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid pull request number: ${value}`);
  }
  return parsed;
}

function readEvent(eventPath: string): {
  pull_request?: { number?: number; body?: string | null; labels?: Array<{ name: string }> };
  number?: number;
  body?: string | null;
  labels?: Array<{ name: string }>;
} {
  return JSON.parse(fs.readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number; body?: string | null; labels?: Array<{ name: string }> };
    number?: number;
    body?: string | null;
    labels?: Array<{ name: string }>;
  };
}

export function readPullNumberFromGitHubEvent(eventPath: string): number | null {
  const event = readEvent(eventPath);
  const pullNumber = event.pull_request?.number ?? event.number;
  return typeof pullNumber === 'number' ? pullNumber : null;
}

function readEventMetadata(eventPath: string): {
  pullNumber: number | null;
  body: string;
  labels: string[];
} {
  const event = readEvent(eventPath);
  const pullNumber = event.pull_request?.number ?? event.number;
  const body = event.pull_request?.body ?? event.body ?? '';
  const labelsRaw = event.pull_request?.labels ?? event.labels ?? [];
  const labels = sortedUnique(labelsRaw.map((entry) => entry.name).filter(Boolean));

  return {
    pullNumber: typeof pullNumber === 'number' ? pullNumber : null,
    body,
    labels
  };
}

async function githubGet<T>(
  url: string,
  token: string,
  fetchImpl: typeof fetch
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`GitHub API request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export async function fetchPullRequestFilesFromGitHubAPI(args: {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const changedFiles: string[] = [];
  let page = 1;

  while (true) {
    const files = await githubGet<Array<{ filename: string }>>(
      `https://api.github.com/repos/${args.owner}/${args.repo}/pulls/${args.pullNumber}/files?per_page=100&page=${page}`,
      args.token,
      fetchImpl
    );

    if (files.length === 0) {
      break;
    }

    changedFiles.push(...files.map((file) => file.filename));
    if (files.length < 100) {
      break;
    }
    page += 1;
  }

  return normalizeChangedFiles(changedFiles);
}

export async function fetchPullRequestMetadataFromGitHubAPI(args: {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<{ body: string; labels: string[]; changedFiles: string[] }> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const pr = await githubGet<GitHubPullRequestPayload>(
    `https://api.github.com/repos/${args.owner}/${args.repo}/pulls/${args.pullNumber}`,
    args.token,
    fetchImpl
  );
  const changedFiles = await fetchPullRequestFilesFromGitHubAPI({
    owner: args.owner,
    repo: args.repo,
    pullNumber: args.pullNumber,
    token: args.token,
    fetchImpl
  });

  return {
    body: pr.body ?? '',
    labels: sortedUnique(pr.labels.map((label) => label.name).filter(Boolean)),
    changedFiles
  };
}

export async function resolvePullRequestMetadata(
  options: PullRequestMetadataOptions = {}
): Promise<PullRequestMetadata> {
  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? '';
  const eventPath = options.eventPath ?? process.env.GITHUB_EVENT_PATH ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;
  const gitExec = options.gitExec ?? defaultGitExec;

  const warnings: string[] = [];
  let eventPullNumber: number | null = null;
  let eventBody = '';
  let eventLabels: string[] = [];

  if (eventPath) {
    const event = readEventMetadata(eventPath);
    eventPullNumber = event.pullNumber;
    eventBody = event.body;
    eventLabels = event.labels;
  }

  const pullNumber = options.pullNumber ?? eventPullNumber;

  if (token && repository && pullNumber) {
    const { owner, repo } = parseRepoRef(repository);
    const apiData = await fetchPullRequestMetadataFromGitHubAPI({
      owner,
      repo,
      pullNumber,
      token,
      fetchImpl
    });
    return {
      pullNumber,
      body: apiData.body,
      labels: apiData.labels,
      changedFiles: apiData.changedFiles,
      source: 'api',
      warnings
    };
  }

  if (options.requireApi) {
    throw new Error(
      'Missing required inputs for PR API metadata resolution. Set GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_EVENT_PATH or pass --pr.'
    );
  }

  if (pullNumber === null) {
    throw new Error('Unable to resolve pull request number from event payload. This validator must run on pull_request events.');
  }

  warnings.push('PR metadata API unavailable; using event payload labels/body and local git changed files.');
  warnings.push(
    'Run: export GITHUB_TOKEN="$(gh auth token)" && export GITHUB_REPOSITORY="OWNER/REPO"'
  );

  return {
    pullNumber,
    body: eventBody,
    labels: eventLabels,
    changedFiles: getChangedFilesFromMain(gitExec),
    source: 'event-fallback',
    warnings
  };
}
