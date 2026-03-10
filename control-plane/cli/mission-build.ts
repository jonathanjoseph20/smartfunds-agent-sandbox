import { main as runMissionMain } from './mission-run.ts';

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  return runMissionMain(['--profile', 'build', ...argv]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write('Mission rejected\nCode: unexpected_runtime_error\nReason: unexpected_runtime_error\n');
    process.exit(2);
  });
}
