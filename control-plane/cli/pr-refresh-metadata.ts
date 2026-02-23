import { execFileSync } from 'node:child_process';

function ensureCleanWorktree(): void {
  const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (status) {
    throw new Error('Working tree is not clean. Commit or stash changes before refreshing metadata.');
  }
}

async function main(): Promise<void> {
  ensureCleanWorktree();
  execFileSync('git', ['commit', '--allow-empty', '-m', 'chore: refresh governance metadata'], { stdio: 'inherit' });
  execFileSync('git', ['push'], { stdio: 'inherit' });
  console.log('Pushed empty commit to refresh governance metadata.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    console.error('Remediation: clean your working tree, then rerun the refresh command.');
    process.exit(1);
  });
}
