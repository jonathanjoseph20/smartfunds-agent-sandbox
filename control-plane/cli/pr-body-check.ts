import { readBodyFile, validatePrBody } from '../governance/pr-body.ts';
import { parsePullNumber, resolvePullRequestMetadata } from '../governance/pr-files-api.ts';

const DEFAULT_BODY_FILE = '.pr-body.md';

type ParsedArgs = {
  bodyFile?: string;
  bodyFileProvided: boolean;
  pr?: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  let bodyFile: string | undefined = DEFAULT_BODY_FILE;
  let bodyFileProvided = false;
  let pr: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--body-file' || arg === '--file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --body-file.');
      }
      bodyFile = value;
      bodyFileProvided = true;
      index += 1;
      continue;
    }
    if (arg.startsWith('--body-file=')) {
      bodyFile = arg.slice('--body-file='.length);
      if (!bodyFile) {
        throw new Error('Missing value for --body-file.');
      }
      bodyFileProvided = true;
      continue;
    }
    if (arg.startsWith('--file=')) {
      bodyFile = arg.slice('--file='.length);
      if (!bodyFile) {
        throw new Error('Missing value for --file.');
      }
      bodyFileProvided = true;
      continue;
    }
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      pr = parsePullNumber(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      pr = parsePullNumber(arg.slice('--pr='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile, bodyFileProvided, pr };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let body: string;
  if (!args.bodyFileProvided && (args.pr !== undefined || process.env.GITHUB_EVENT_PATH)) {
    const metadata = await resolvePullRequestMetadata({
      pullNumber: args.pr,
      requireApi: true
    });
    body = metadata.body;
  } else {
    body = readBodyFile(args.bodyFile ?? DEFAULT_BODY_FILE);
  }
  const result = validatePrBody(body);
  console.log(`PR body OK. Tier: ${result.tier}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
