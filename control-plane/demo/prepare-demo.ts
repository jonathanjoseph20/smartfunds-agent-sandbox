import { execFileSync } from 'node:child_process';
import process from 'node:process';

function runGit(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function ensureWorkspacesPath(): void {
  const cwd = process.cwd();
  if (!cwd.startsWith('/workspaces/')) {
    console.error(`Expected repository under /workspaces/. Current path: ${cwd}`);
    console.error('Move to the Codespaces workspace path and retry.');
    process.exit(1);
  }
}

function ensureCleanWorktree(): void {
  const status = runGit(['status', '--porcelain']);
  if (status) {
    console.error('Working tree is not clean. Commit or stash changes before demo prep.');
    console.error('Run: git status -sb');
    process.exit(1);
  }
}

function ensureOnMain(): void {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') {
    console.error(`Current branch is ${branch}. Switch to main for demo prep.`);
    console.error('Run: git checkout main');
    process.exit(1);
  }
}

function ensureOriginMainExists(): void {
  try {
    runGit(['rev-parse', '--verify', 'origin/main']);
  } catch {
    console.error('origin/main not found locally. Fetch before demo prep.');
    console.error('Run: git fetch origin main');
    process.exit(1);
  }
}

function ensureMainUpToDate(): void {
  const counts = runGit(['rev-list', '--left-right', '--count', 'main...origin/main']);
  const [aheadRaw, behindRaw] = counts.split('\t');
  const ahead = Number.parseInt(aheadRaw ?? '0', 10);
  const behind = Number.parseInt(behindRaw ?? '0', 10);

  if (Number.isNaN(ahead) || Number.isNaN(behind)) {
    console.error(`Unable to parse rev-list counts: ${counts}`);
    process.exit(1);
  }

  if (behind > 0) {
    console.error(`main is behind origin/main by ${behind} commit(s).`);
    console.error('Update main before demo prep. Run: git pull --ff-only');
    process.exit(1);
  }

  if (ahead > 0) {
    console.error(`main is ahead of origin/main by ${ahead} commit(s).`);
    console.error('Push or reset main before demo prep.');
    process.exit(1);
  }
}

function runMissionEngineTests(): void {
  try {
    execFileSync('npm', ['--workspace', '@smartfunds/mission-engine', 'test'], { stdio: 'inherit' });
  } catch {
    console.error('Mission engine tests failed. Fix failures before running the demo.');
    process.exit(1);
  }
}

function printChecklist(): void {
  const lines = [
    '',
    'Demo prep complete. Operator checklist:',
    '1. Ensure working tree is clean and on main.',
    '2. Confirm local tests are green.',
    '3. Follow the 3-cycle demo plan below.',
    '',
    '3-Cycle Demo Plan (commands):',
    'Cycle 1 (feature, Tier 1 expected):',
    '  npm run demo:prepare',
    '  npm --workspace @smartfunds/mission-engine test',
    '  npm run governance:generate',
    '  npm run governance:normalize',
    '  npm run governance:preflight',
    '  npm run pr:create',
    '  npm run pr:verify',
    '',
    'Cycle 2 (refactor, Tier 1 expected):',
    '  git checkout -b sprint-17-cycle-2-refactor',
    '  # implement deterministic refactor',
    '  npm test',
    '  npm run governance:generate',
    '  npm run governance:normalize',
    '  npm run governance:preflight',
    '  npm run pr:create',
    '  npm run pr:verify',
    '',
    'Cycle 3 (bug fix + regression, Tier 2 expected):',
    '  git checkout -b sprint-17-cycle-3-bugfix',
    '  # add failing test, then fix',
    '  npm test',
    '  npm run governance:generate',
    '  npm run governance:normalize',
    '  npm run governance:preflight',
    '  npm run pr:create',
    '  npm run pr:verify',
    '',
    'Reference plan: control-plane/demo/demo-plan.md'
  ];

  for (const line of lines) {
    console.log(line);
  }
}

function main(): void {
  ensureWorkspacesPath();
  ensureCleanWorktree();
  ensureOnMain();
  ensureOriginMainExists();
  ensureMainUpToDate();
  runMissionEngineTests();
  printChecklist();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
