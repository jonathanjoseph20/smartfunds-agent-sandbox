import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  EVIDENCE_JSON_PATH,
  resolveEvidencePath,
  stringifyEvidenceJson
} from '../governance/evidence-contract.ts';
import { generateEvidenceFromPullRequestMetadata } from '../governance/evidence-generation.ts';
import { parsePullNumber, readPullNumberFromGitHubEvent, resolvePullRequestMetadata } from '../governance/pr-files-api.ts';

type ParsedArgs = {
  outFile: string;
  pr?: number;
};

const DRIFT_REMEDIATION =
  'Evidence drift detected. Run: npm run governance:emit && git add governance/evidence.json && git commit -m "fix(governance): emit canonical evidence"';
const LOCAL_PR_GUIDANCE = [
  'Missing pull request number. Provide --pr <N> when GITHUB_EVENT_PATH is unavailable or missing pull_request metadata.',
  'Examples:',
  'npm run governance:emit:ci -- --pr 73',
  'npm run governance:emit:ci:local -- 73'
].join('\n');

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    outFile: EVIDENCE_JSON_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --out-file.');
      }
      parsed.outFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--out-file=')) {
      parsed.outFile = arg.slice('--out-file='.length);
      continue;
    }
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      parsed.pr = parsePullNumber(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      parsed.pr = parsePullNumber(arg.slice('--pr='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readCanonicalRepositoryEvidence(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return canonicalStringify(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function runGovernanceEmitCi(argv: string[]): Promise<{
  writtenPath: string;
  evidenceHash: string;
  driftDetected: boolean;
  pullNumber: number;
}> {
  const args = parseArgs(argv);
  const outputPath = resolveEvidencePath(args.outFile);
  const eventPath = process.env.GITHUB_EVENT_PATH ?? '';

  if (args.pr === undefined) {
    const hasUsableEventPullNumber = eventPath && fs.existsSync(eventPath)
      ? readPullNumberFromGitHubEvent(eventPath) !== null
      : false;
    if (!hasUsableEventPullNumber) {
      throw new Error(LOCAL_PR_GUIDANCE);
    }
  }

  let metadata;
  try {
    metadata = await resolvePullRequestMetadata({
      pullNumber: args.pr,
      requireApi: true
    });
  } catch (error) {
    throw new Error(
      `${(error as Error).message}\nRun: export GITHUB_TOKEN="$(gh auth token)" && export GITHUB_REPOSITORY="OWNER/REPO" && npm run governance:emit:ci -- --pr <N>`
    );
  }

  const evidence = generateEvidenceFromPullRequestMetadata({
    labels: metadata.labels,
    changedFiles: metadata.changedFiles
  });

  const generatedCanonical = canonicalStringify(evidence);
  const repositoryCanonical = readCanonicalRepositoryEvidence(outputPath);
  const driftDetected = repositoryCanonical !== generatedCanonical;

  const content = stringifyEvidenceJson(evidence);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');

  const evidenceHash = sha256(generatedCanonical);
  console.log(`Evidence SHA: ${evidenceHash}`);
  console.log(`governance/evidence.json sha256=${evidenceHash}`);

  if (driftDetected) {
    throw new Error(DRIFT_REMEDIATION);
  }

  return {
    writtenPath: outputPath,
    evidenceHash,
    driftDetected,
    pullNumber: metadata.pullNumber
  };
}

async function main(): Promise<void> {
  const result = await runGovernanceEmitCi(process.argv.slice(2));
  console.log(`Wrote ${result.writtenPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs };
