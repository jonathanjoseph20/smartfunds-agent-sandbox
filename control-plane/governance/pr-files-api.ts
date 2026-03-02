// control-plane/governance/pr-files-api.ts
import fs from "node:fs/promises";

export type RepoRef = { owner: string; repo: string };

export function parseRepoRef(repoFull: string): RepoRef {
  const [owner, repo] = repoFull.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: "${repoFull}" (expected "owner/repo")`);
  }
  return { owner, repo };
}

export async function readPullNumberFromGitHubEvent(): Promise<number | null> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;

  const raw = await fs.readFile(eventPath, "utf8");
  const evt = JSON.parse(raw);

  // Typical pull_request payload
  const prNumber = evt?.pull_request?.number ?? evt?.number;
  return typeof prNumber === "number" ? prNumber : null;
}

export async function fetchPullRequestFilesFromGitHubAPI(args: {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
}): Promise<string[]> {
  const { owner, repo, pullNumber, token } = args;

  const perPage = 100;
  let page = 1;
  const paths: string[] = [];

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to fetch PR files (${res.status}): ${text}`);
    }

    const data = (await res.json()) as Array<{ filename: string }>;
    for (const item of data) paths.push(item.filename);

    if (data.length < perPage) break;
    page += 1;
  }

  // deterministic ordering
  return paths.slice().sort();
}

export async function tryGetChangedFilesFromPRApi(): Promise<string[] | null> {
  const isCI = process.env.GITHUB_ACTIONS === "true";
  const eventName = process.env.GITHUB_EVENT_NAME || "";
  if (!isCI) return null;
  if (!eventName.includes("pull_request")) return null;

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const repoFull = process.env.GITHUB_REPOSITORY || "";
  if (!token || !repoFull) return null;

  const pullNumber = await readPullNumberFromGitHubEvent();
  if (!pullNumber) return null;

  const { owner, repo } = parseRepoRef(repoFull);
  return fetchPullRequestFilesFromGitHubAPI({ owner, repo, pullNumber, token });
}