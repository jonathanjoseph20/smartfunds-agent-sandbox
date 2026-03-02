import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { getChangedFilesFromMain, defaultGitExec, type GitExec } from '../governance/changed-files.ts';
import {
  EVIDENCE_JSON_PATH,
  buildCanonicalEvidence,
  readEvidenceContract,
  resolveEvidencePath,
  stringifyEvidenceJson,
  type EvidenceMode
} from '../governance/evidence-contract.ts';
import { type Tier, extractTierFromLabels } from '../governance/diagnostics.ts';
import { classifyPaths } from '../governance/tier-policy.ts';
import {
  DEFAULT_DETERMINISM_STATEMENT,
  resolveEvidenceModeFromChangedFiles
} from '../governance/evidence-generation.ts';

type ParsedArgs = {
  tier?: Tier;
  mode?: EvidenceMode;
  determinismStatement?: string;
  retrySemanticsModified?: boolean;
  autonomyScopeExpanded?: boolean;
  notes?: string;
  railImpacted?: boolean;
  entityRegistryImpacted?: boolean;
  stage: boolean;
  outFile: string;
};

function parseTier(value: string): Tier {
  const parsed = Number.parseInt(value, 10);
  if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed;
  }
  throw new Error('tier must be 0, 1, 2, or 3.');
}

function parseMode(value: string): EvidenceMode {
  if (value === 'structured' || value === 'autonomous') {
    return value;
  }
  throw new Error('mode must be structured or autonomous.');
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === 'no' || normalized === 'n' || normalized === '0') {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    stage: false,
    outFile: EVIDENCE_JSON_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--stage') {
      parsed.stage = true;
      continue;
    }
    if (arg === '--tier') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --tier.');
      }
      parsed.tier = parseTier(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--tier=')) {
      parsed.tier = parseTier(arg.slice('--tier='.length));
      continue;
    }
    if (arg === '--mode') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --mode.');
      }
      parsed.mode = parseMode(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      parsed.mode = parseMode(arg.slice('--mode='.length));
      continue;
    }
    if (arg === '--determinism-statement') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --determinism-statement.');
      }
      parsed.determinismStatement = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--determinism-statement=')) {
      parsed.determinismStatement = arg.slice('--determinism-statement='.length);
      continue;
    }
    if (arg === '--retry-semantics-modified') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --retry-semantics-modified.');
      }
      parsed.retrySemanticsModified = parseBoolean(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--retry-semantics-modified=')) {
      parsed.retrySemanticsModified = parseBoolean(arg.slice('--retry-semantics-modified='.length));
      continue;
    }
    if (arg === '--autonomy-scope-expanded') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --autonomy-scope-expanded.');
      }
      parsed.autonomyScopeExpanded = parseBoolean(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--autonomy-scope-expanded=')) {
      parsed.autonomyScopeExpanded = parseBoolean(arg.slice('--autonomy-scope-expanded='.length));
      continue;
    }
    if (arg === '--notes') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --notes.');
      }
      parsed.notes = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--notes=')) {
      parsed.notes = arg.slice('--notes='.length);
      continue;
    }
    if (arg === '--rail-impacted') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --rail-impacted.');
      }
      parsed.railImpacted = parseBoolean(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--rail-impacted=')) {
      parsed.railImpacted = parseBoolean(arg.slice('--rail-impacted='.length));
      continue;
    }
    if (arg === '--entity-registry-impacted') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --entity-registry-impacted.');
      }
      parsed.entityRegistryImpacted = parseBoolean(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--entity-registry-impacted=')) {
      parsed.entityRegistryImpacted = parseBoolean(arg.slice('--entity-registry-impacted='.length));
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
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function stageFile(filePath: string): void {
  execFileSync('git', ['add', filePath], { stdio: 'pipe' });
}

function readLabelsFromLocalMetadata(): string[] {
  const labelsFile = fs.existsSync('.pr-labels.txt') ? '.pr-labels.txt' : fs.existsSync('pr-labels.txt') ? 'pr-labels.txt' : null;
  if (!labelsFile) {
    return [];
  }
  return fs
    .readFileSync(labelsFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function readExistingEvidence(): {
  tier: Tier;
  mode: EvidenceMode;
  determinismStatement: string;
  retrySemanticsModified: boolean;
  autonomyScopeExpanded: boolean;
} | null {
  const parsed = readEvidenceContract({ enforceCanonical: false });
  if (!parsed.exists || !('evidence' in parsed)) {
    return null;
  }

  return {
    tier: parsed.evidence.tier,
    mode: parsed.evidence.mode,
    determinismStatement: parsed.evidence.determinismStatement,
    retrySemanticsModified: parsed.evidence.retrySemanticsModified,
    autonomyScopeExpanded: parsed.evidence.autonomyScopeExpanded
  };
}

function resolveLocalTier(args: ParsedArgs, changedFiles: string[], existing: ReturnType<typeof readExistingEvidence>): Tier {
  if (args.tier !== undefined) {
    return args.tier;
  }

  const labelTier = extractTierFromLabels(readLabelsFromLocalMetadata());
  if (labelTier !== undefined) {
    return labelTier;
  }

  if (existing) {
    return existing.tier;
  }

  return classifyPaths(changedFiles).impliedTier;
}

function resolveLocalMode(args: ParsedArgs, changedFiles: string[], existing: ReturnType<typeof readExistingEvidence>): EvidenceMode {
  if (args.mode !== undefined) {
    return args.mode;
  }

  if (existing) {
    return existing.mode;
  }

  return resolveEvidenceModeFromChangedFiles(changedFiles);
}

export async function runGovernanceEmit(
  argv: string[],
  deps: {
    gitExec?: GitExec;
  } = {}
): Promise<{ writtenPath: string; content: string; changedFiles: string[] }> {
  const args = parseArgs(argv);
  const gitExec = deps.gitExec ?? defaultGitExec;
  const changedFiles = getChangedFilesFromMain(gitExec);
  const existing = readExistingEvidence();

  const evidence = buildCanonicalEvidence({
    tier: resolveLocalTier(args, changedFiles, existing),
    mode: resolveLocalMode(args, changedFiles, existing),
    affectedPaths: changedFiles,
    determinismStatement: args.determinismStatement ?? existing?.determinismStatement ?? DEFAULT_DETERMINISM_STATEMENT,
    retrySemanticsModified: args.retrySemanticsModified ?? existing?.retrySemanticsModified ?? false,
    autonomyScopeExpanded: args.autonomyScopeExpanded ?? existing?.autonomyScopeExpanded ?? false,
    ...(args.notes !== undefined ? { notes: args.notes } : {}),
    ...(args.railImpacted !== undefined ? { railImpacted: args.railImpacted } : {}),
    ...(args.entityRegistryImpacted !== undefined ? { entityRegistryImpacted: args.entityRegistryImpacted } : {})
  });

  const content = stringifyEvidenceJson(evidence);
  const outputPath = resolveEvidencePath(args.outFile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');

  const validation = readEvidenceContract({
    evidencePath: outputPath
  });
  if (!validation.exists || !('evidence' in validation)) {
    const messages = validation.errors.join('\n');
    throw new Error(`Generated evidence is invalid.\n${messages}`);
  }

  if (args.stage) {
    stageFile(outputPath);
  }

  return {
    writtenPath: outputPath,
    content,
    changedFiles
  };
}

async function main(): Promise<void> {
  const result = await runGovernanceEmit(process.argv.slice(2));
  console.log(`Wrote ${result.writtenPath}`);
  console.log(`Affected paths: ${result.changedFiles.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs };
