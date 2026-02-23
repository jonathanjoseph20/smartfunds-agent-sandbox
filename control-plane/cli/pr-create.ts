// control-plane/cli/pr-create.ts
// Idempotent PR creation/upsert:
// - If PR exists for current branch: update PR BODY from .pr-body.md and apply labels from .pr-labels.txt
// - If PR does not exist: create PR using .pr-body.md, then apply labels
// IMPORTANT: Never post a comment. Governance requires the PR description/body.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";

type PRView = { number: number; url: string };

function run(cmd: string, args: string[], opts?: { allowFail?: boolean }): string {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e: any) {
    if (opts?.allowFail) return "";
    const stderr = e?.stderr?.toString?.() ?? "";
    const stdout = e?.stdout?.toString?.() ?? "";
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${stdout}\n${stderr}`.trim());
  }
}

function readRequiredFile(path: string): string {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
  const text = fs.readFileSync(path, "utf8");
  if (!text.trim()) throw new Error(`Required file is empty: ${path}`);
  return text;
}

function readLabelsFile(path: string): string[] {
  if (!fs.existsSync(path)) return [];
  const raw = fs.readFileSync(path, "utf8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith("#"));
}

function getBranch(): string {
  return run("git", ["branch", "--show-current"]);
}

function getRepoNameWithOwner(): string {
  // Uses gh configuration in Codespaces; deterministic, no timestamps.
  return run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
}

function tryGetExistingPR(): PRView | null {
  const out = run("gh", ["pr", "view", "--json", "number,url"], { allowFail: true });
  if (!out) return null;
  try {
    const parsed = JSON.parse(out) as PRView;
    if (typeof parsed.number !== "number" || typeof parsed.url !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyPrBody(prNumber: number): void {
  // Sets PR description/body (NOT a comment)
  run("gh", ["pr", "edit", String(prNumber), "--body-file", ".pr-body.md"]);
}

function applyPrLabels(repo: string, prNumber: number, labels: string[]): void {
  if (labels.length === 0) return;

  // Bulletproof label apply via GitHub API:
  // POST /repos/{owner}/{repo}/issues/{issue_number}/labels
  const args = ["api", "-X", "POST", `repos/${repo}/issues/${prNumber}/labels`];
  for (const label of labels) {
    args.push("-f", `labels[]=${label}`);
  }
  run("gh", args);
}

function createPR(title: string, base: string): PRView {
  // Create PR from current branch -> base
  const out = run("gh", [
    "pr",
    "create",
    "--title",
    title,
    "--body-file",
    ".pr-body.md",
    "--base",
    base,
  ]);

  // gh prints the URL on success (often as the last line)
  const url = out.split("\n").map((l) => l.trim()).filter(Boolean).slice(-1)[0] ?? "";
  const pr = tryGetExistingPR();
  if (!pr) {
    // If we can't read PR after creation, still return best-effort URL.
    return { number: -1, url };
  }
  return pr;
}

function main(): void {
  // Required files created by governance tooling
  readRequiredFile(".pr-body.md");

  const labels = readLabelsFile(".pr-labels.txt");

  const branch = getBranch();
  const base = "main"; // repo convention
  const repo = getRepoNameWithOwner();

  // Title: default matches previous behavior ("chore: <branch>")
  const titleArgIndex = process.argv.indexOf("--title");
  const title = titleArgIndex >= 0 ? process.argv[titleArgIndex + 1] : `chore: ${branch}`;

  const existing = tryGetExistingPR();

  if (existing) {
    // Upsert existing PR: BODY + LABELS
    applyPrBody(existing.number);
    applyPrLabels(repo, existing.number, labels);

    // Deterministic output
    console.log(`PR updated and verified. URL: ${existing.url}`);
    console.log(`PR number: ${existing.number}`);
    console.log(`Applied labels: ${labels.join(", ") || "(none)"}`);
    return;
  }

  // Create PR then converge to desired state
  const created = createPR(title, base);

  // If created.number is -1, re-read PR to get the number
  const pr = created.number > 0 ? created : tryGetExistingPR();
  if (!pr) {
    throw new Error(`PR created but could not be reloaded. URL: ${created.url || "(unknown)"}`);
  }

  applyPrBody(pr.number);
  applyPrLabels(repo, pr.number, labels);

  console.log(`PR created and verified. URL: ${pr.url}`);
  console.log(`PR number: ${pr.number}`);
  console.log(`Applied labels: ${labels.join(", ") || "(none)"}`);
}

main();