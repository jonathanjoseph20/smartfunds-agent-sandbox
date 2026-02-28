import { execFileSync } from 'node:child_process';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function exec(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8' });
}

function parseRemoteUrl(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return null;
  }

  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  const sshUrlMatch = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshUrlMatch) {
    return `${sshUrlMatch[1]}/${sshUrlMatch[2]}`;
  }

  return null;
}

export function resolveOwnerRepoFromGitOrEnv(envRepository = process.env.GITHUB_REPOSITORY): string {
  if (envRepository && /^[-\w.]+\/[-\w.]+$/.test(envRepository)) {
    return envRepository;
  }

  const remoteUrl = exec('git', ['config', '--get', 'remote.origin.url']).trim();
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) {
    throw new Error(
      'Unable to determine owner/repo from GITHUB_REPOSITORY or git remote.origin.url. Set GITHUB_REPOSITORY=owner/repo or fix remote.origin.url.'
    );
  }

  return parsed;
}

export function fetchPrBody(prNumber: number): string {
  return exec('gh', ['pr', 'view', String(prNumber), '--json', 'body', '--jq', '.body']).replace(/\r\n?/g, '\n').trim();
}

export function fetchPrLabels(prNumber: number): string[] {
  const output = exec('gh', ['pr', 'view', String(prNumber), '--json', 'labels', '--jq', '.labels[].name']);
  if (!output.trim()) {
    return [];
  }

  return sortedUnique(
    output
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

export function fetchPrComments(prNumber: number, ownerRepo?: string): Array<{ id: number; body: string }> {
  const repoSlug = ownerRepo ?? resolveOwnerRepoFromGitOrEnv();
  const output = exec('gh', [
    'api',
    `repos/${repoSlug}/issues/${prNumber}/comments`,
    '--paginate',
    '--jq',
    '.[] | {id: .id, body: .body}'
  ]);

  const comments = output
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { id: number; body: string })
    .filter((entry) => Number.isInteger(entry.id) && typeof entry.body === 'string');

  return comments.sort((a, b) => a.id - b.id);
}
