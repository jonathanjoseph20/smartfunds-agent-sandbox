import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  EVIDENCE_JSON_PATH,
  readEvidenceContract,
  renderEvidenceSummaryMarkdown,
  resolveEvidencePath
} from '../governance/evidence-contract.ts';

type ParsedArgs = {
  evidenceFile: string;
  outFile: string;
  pr?: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    evidenceFile: EVIDENCE_JSON_PATH,
    outFile: '.pr-body.md'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--evidence-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --evidence-file.');
      }
      parsed.evidenceFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--evidence-file=')) {
      parsed.evidenceFile = arg.slice('--evidence-file='.length);
      continue;
    }
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
      parsed.pr = Number.parseInt(value, 10);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      parsed.pr = Number.parseInt(arg.slice('--pr='.length), 10);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.pr !== undefined && (!Number.isInteger(parsed.pr) || parsed.pr <= 0)) {
    throw new Error('--pr must be a positive integer.');
  }
  return parsed;
}

function editPrBody(pr: number, body: string): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-sync-'));
  const tempFile = path.join(tempDir, 'pr-body.md');
  try {
    fs.writeFileSync(tempFile, body, 'utf8');
    execFileSync('gh', ['pr', 'edit', String(pr), '--body-file', tempFile], { stdio: 'pipe' });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function buildGovernancePrBodySummary(evidenceFilePath: string): string {
  const absoluteEvidencePath = resolveEvidencePath(evidenceFilePath);
  const parsed = readEvidenceContract({ evidencePath: absoluteEvidencePath });
  if (!parsed.exists) {
    throw new Error(`Evidence file not found: ${absoluteEvidencePath}`);
  }
  if (!('evidence' in parsed)) {
    throw new Error(parsed.errors.join('\n'));
  }
  return renderEvidenceSummaryMarkdown(parsed.evidence);
}

export async function runGovernanceSyncPrBody(argv: string[]): Promise<{
  outFile: string;
  body: string;
  syncedToGh: boolean;
}> {
  const args = parseArgs(argv);
  const body = buildGovernancePrBodySummary(args.evidenceFile);
  fs.writeFileSync(args.outFile, body, 'utf8');

  if (args.pr !== undefined) {
    editPrBody(args.pr, body);
    return { outFile: args.outFile, body, syncedToGh: true };
  }

  return { outFile: args.outFile, body, syncedToGh: false };
}

async function main(): Promise<void> {
  const result = await runGovernanceSyncPrBody(process.argv.slice(2));
  console.log(`Wrote ${result.outFile}`);
  if (result.syncedToGh) {
    console.log('Synced PR body through gh cli.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs };
