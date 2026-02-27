import { main } from './governance-runtime.ts';

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(2);
  });
}
