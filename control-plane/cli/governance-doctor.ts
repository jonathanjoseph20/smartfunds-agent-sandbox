import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { readEvidenceContract, stringifyEvidenceJson } from '../governance/evidence-contract.ts';
import { validateEvidenceShape } from '../governance/evidence-schema.ts';
import {
  resolveEvidenceModeFromChangedFiles,
  resolveEvidenceTierFromLabels
} from '../governance/evidence-generation.ts';
import { evaluateModePolicy } from '../governance/mode-policy.ts';
import { parsePullNumber, resolvePullRequestMetadata } from '../governance/pr-files-api.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';

type ParsedArgs = {
  pr?: number;
};

type DoctorFailure = {
  reason: string;
  run: string;
};

const EVIDENCE_DRIFT_FIX =
  'npm run governance:emit && git add governance/evidence.json && git commit -m "fix(governance): emit canonical evidence"';

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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

function readEventLabels(eventPath: string | undefined): string[] {
  if (!eventPath || !fs.existsSync(eventPath)) {
    return [];
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as {
    pull_request?: { labels?: Array<{ name: string }> };
    labels?: Array<{ name: string }>;
  };
  const labels = event.pull_request?.labels ?? event.labels ?? [];
  return Array.from(new Set(labels.map((entry) => entry.name).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function addFailure(failures: DoctorFailure[], reason: string, run: string): void {
  failures.push({ reason, run });
}

function printFailures(failures: DoctorFailure[]): void {
  for (const failure of failures) {
    console.log(`❌ ${failure.reason}`);
    console.log(`Run: ${failure.run}`);
  }
}

export async function runGovernanceDoctor(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const failures: DoctorFailure[] = [];
  const evidencePath = 'governance/evidence.json';

  let evidenceRaw = '';
  let parsedEvidence: unknown = null;
  if (!fs.existsSync(evidencePath)) {
    addFailure(failures, 'Missing governance/evidence.json', EVIDENCE_DRIFT_FIX);
  } else {
    evidenceRaw = fs.readFileSync(evidencePath, 'utf8');
    try {
      parsedEvidence = JSON.parse(evidenceRaw) as unknown;
    } catch {
      addFailure(failures, 'governance/evidence.json is not valid JSON', EVIDENCE_DRIFT_FIX);
    }
  }

  if (parsedEvidence !== null) {
    const shapeErrors = validateEvidenceShape(parsedEvidence);
    if (shapeErrors.length > 0) {
      addFailure(failures, `Evidence schema shape invalid (${shapeErrors.join('; ')})`, EVIDENCE_DRIFT_FIX);
    }
  }

  const evidenceContract = readEvidenceContract({ enforceCanonical: false });
  if (!evidenceContract.exists || !('evidence' in evidenceContract)) {
    if (evidenceContract.errors.length > 0) {
      addFailure(failures, evidenceContract.errors[0], EVIDENCE_DRIFT_FIX);
    }
    printFailures(failures);
    return failures.length === 0 ? 0 : 1;
  }

  const canonical = stringifyEvidenceJson(evidenceContract.evidence);
  if (evidenceRaw !== canonical) {
    addFailure(failures, 'Evidence drift detected', EVIDENCE_DRIFT_FIX);
  }

  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  if (!token || !repository) {
    addFailure(
      failures,
      'Missing env vars for local full validation',
      'export GITHUB_TOKEN="$(gh auth token)"\nexport GITHUB_REPOSITORY="OWNER/REPO"\n# then rerun: npm run governance:validate:local -- --mode full --pr 70'
    );
  }

  let metadata:
    | Awaited<ReturnType<typeof resolvePullRequestMetadata>>
    | null = null;

  try {
    metadata = await resolvePullRequestMetadata({
      pullNumber: args.pr,
      requireApi: false
    });
  } catch {
    metadata = null;
  }

  if (metadata) {
    if (canonicalStringify(evidenceContract.evidence.affectedPaths) !== canonicalStringify(metadata.changedFiles)) {
      addFailure(failures, 'Evidence drift detected', EVIDENCE_DRIFT_FIX);
    }

    try {
      const labelTier = resolveEvidenceTierFromLabels(metadata.labels);
      if (labelTier !== evidenceContract.evidence.tier) {
        addFailure(failures, 'Tier label/evidence mismatch', EVIDENCE_DRIFT_FIX);
      }
    } catch (error) {
      addFailure(failures, (error as Error).message, EVIDENCE_DRIFT_FIX);
    }

    const impliedMode = resolveEvidenceModeFromChangedFiles(metadata.changedFiles);
    if (impliedMode !== evidenceContract.evidence.mode) {
      addFailure(failures, 'Mode evidence mismatch', EVIDENCE_DRIFT_FIX);
    }

    const teamResolution = resolveTeamsForChangedFiles(metadata.changedFiles);
    const modePolicy = evaluateModePolicy({
      executionModesTouched: teamResolution.executionModesTouched,
      declaredTier: evidenceContract.evidence.tier
    });
    if (modePolicy.status === 'failed') {
      addFailure(
        failures,
        modePolicy.message ?? 'Mode policy violation',
        'npm run governance:doctor && npm run governance:emit'
      );
    }

    const eventLabels = readEventLabels(process.env.GITHUB_EVENT_PATH);
    if (eventLabels.length > 0 && canonicalStringify(eventLabels) !== canonicalStringify(metadata.labels)) {
      addFailure(
        failures,
        'CI may be reading stale PR metadata',
        'git commit --allow-empty -m "chore: refresh governance metadata" && git push'
      );
    }
    if (metadata.source === 'event-fallback') {
      addFailure(
        failures,
        'CI may be reading stale PR metadata',
        'git commit --allow-empty -m "chore: refresh governance metadata" && git push'
      );
    }
  }

  printFailures(failures);
  if (failures.length === 0) {
    console.log('Governance doctor passed.');
  }
  return failures.length === 0 ? 0 : 1;
}

async function main(): Promise<void> {
  const code = await runGovernanceDoctor(process.argv.slice(2));
  process.exit(code);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs };
