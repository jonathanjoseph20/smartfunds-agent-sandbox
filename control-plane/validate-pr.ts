import fs from 'node:fs';
import path from 'node:path';

type Tier = 0 | 1 | 2 | 3;

const TIER_LABELS = ['tier-0', 'tier-1', 'tier-2', 'tier-3'] as const;
const EVIDENCE_FIELDS = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
] as const;

export interface RiskContract {
  tiers: Record<string, { description: string; required_checks: string[] }>;
  paths: Record<string, Tier>;
}

export interface PullRequestData {
  body: string;
  labels: string[];
  changedFiles: string[];
}

export interface ValidationResult {
  ok: boolean;
  tierLabel?: Tier;
  tierBody?: Tier;
  impliedTier: Tier;
  escalationFiles: string[];
  errors: string[];
}

export function extractTierFromLabels(labels: string[]): Tier | undefined {
  const tiers = labels
    .map((label) => label.match(/^tier-([0-3])$/)?.[1])
    .filter((tier): tier is string => Boolean(tier));

  if (tiers.length === 0) {
    return undefined;
  }

  const unique = [...new Set(tiers)];
  if (unique.length > 1) {
    throw new Error(
      `Multiple tier labels detected (${unique
        .map((tier) => `tier-${tier}`)
        .join(', ')}). Keep exactly one of: ${TIER_LABELS.join(', ')}.`
    );
  }

  return Number.parseInt(unique[0], 10) as Tier;
}

export function parseEvidenceBlock(body: string): Record<string, string> | undefined {
  const match = body.match(/```evidence\s*([\s\S]*?)```/i);
  if (!match) {
    return undefined;
  }

  const parsed: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    parsed[key] = value;
  }

  return parsed;
}

export function extractTierFromEvidence(body: string): Tier | undefined {
  const evidence = parseEvidenceBlock(body);
  const tierValue = evidence?.['Risk Tier'];
  if (!tierValue) {
    return undefined;
  }

  const normalized = tierValue.trim().match(/^[0-3]$/)?.[0];
  if (!normalized) {
    return undefined;
  }

  return Number.parseInt(normalized, 10) as Tier;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(glob: string): RegExp {
  const escaped = escapeRegex(glob);
  const pattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');

  return new RegExp(`^${pattern}$`);
}

export function inferImpliedTier(changedFiles: string[], contract: RiskContract): {
  impliedTier: Tier;
  escalationFiles: string[];
} {
  let impliedTier: Tier = 0;
  let escalationFiles: string[] = [];

  const rules = Object.entries(contract.paths).map(([glob, tier]) => ({
    glob,
    tier,
    regex: globToRegExp(glob)
  }));

  for (const file of changedFiles) {
    let fileTier: Tier = 0;
    for (const rule of rules) {
      if (rule.regex.test(file) && rule.tier > fileTier) {
        fileTier = rule.tier;
      }
    }

    if (fileTier > impliedTier) {
      impliedTier = fileTier;
      escalationFiles = [file];
    } else if (fileTier === impliedTier && fileTier > 0) {
      escalationFiles.push(file);
    }
  }

  return { impliedTier, escalationFiles };
}

export function validatePrData(pr: PullRequestData, contract: RiskContract): ValidationResult {
  const errors: string[] = [];
  let tierLabel: Tier | undefined;

  try {
    tierLabel = extractTierFromLabels(pr.labels);
  } catch (error) {
    errors.push((error as Error).message);
  }

  const evidence = parseEvidenceBlock(pr.body);
  const tierBody = extractTierFromEvidence(pr.body);
  const { impliedTier, escalationFiles } = inferImpliedTier(pr.changedFiles, contract);

  if (tierLabel === undefined) {
    errors.push(`Missing risk tier label. Add exactly one: ${TIER_LABELS.join(', ')}.`);
  }

  if (!evidence) {
    errors.push(
      `Missing fenced evidence block. Paste:\n\n\`\`\`evidence\nRisk Tier: <0|1|2|3>\nJustification: <why this tier>\nAffected Paths: <comma-separated globs or file list>\nTests Added: <what you ran/added, or "N/A" with reason>\nDeterminism Statement: <why this change is deterministic and reproducible>\n\`\`\``
    );
  } else {
    const missingFields = EVIDENCE_FIELDS.filter((field) => !evidence[field]);
    if (missingFields.length > 0) {
      errors.push(`Evidence block is missing required field(s): ${missingFields.join(', ')}.`);
    }
  }

  if (evidence && tierBody === undefined) {
    errors.push('Evidence block must include `Risk Tier: <0|1|2|3>`.');
  }

  if (tierLabel !== undefined && tierBody !== undefined && tierBody !== tierLabel) {
    errors.push(
      `Risk tier mismatch: labels are authoritative. Label tier is ${tierLabel}; update PR body evidence Risk Tier to ${tierLabel}.`
    );
  }

  if (tierLabel !== undefined && tierLabel < impliedTier) {
    errors.push(
      `Declared tier-${tierLabel} is below implied tier-${impliedTier}. Escalating files: ${escalationFiles.join(', ')}.`
    );
  }

  if (tierLabel === 3 && !pr.labels.includes('tier-3-approved')) {
    errors.push(
      "Tier 3 requires `tier-3-approved` label. Add it, and if CI still shows stale labels/body, push a new commit to refresh the PR payload."
    );
  }

  return {
    ok: errors.length === 0,
    tierLabel,
    tierBody,
    impliedTier,
    escalationFiles,
    errors
  };
}

async function githubGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export async function fetchPrDataFromGitHub(): Promise<PullRequestData> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !repository || !eventPath) {
    throw new Error('Missing required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH.');
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number };
  };
  const prNumber = event.pull_request?.number;

  if (!prNumber) {
    throw new Error('This validator must run on pull_request events.');
  }

  const [owner, repo] = repository.split('/');
  const pr = await githubGet<{ body: string | null; labels: Array<{ name: string }> }>(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    token
  );

  const changedFiles: string[] = [];
  let page = 1;

  while (true) {
    const files = await githubGet<Array<{ filename: string }>>(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      token
    );

    if (files.length === 0) {
      break;
    }

    changedFiles.push(...files.map((file) => file.filename));
    if (files.length < 100) {
      break;
    }
    page += 1;
  }

  return {
    body: pr.body ?? '',
    labels: pr.labels.map((label) => label.name),
    changedFiles
  };
}

export function loadRiskContract(contractPath = path.resolve('control-plane/risk-contract.json')): RiskContract {
  return JSON.parse(fs.readFileSync(contractPath, 'utf8')) as RiskContract;
}

async function main(): Promise<void> {
  const contract = loadRiskContract();
  const prData = await fetchPrDataFromGitHub();
  const result = validatePrData(prData, contract);

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (result.tierLabel === undefined) {
    throw new Error('Unexpected state: tier label not resolved after validation.');
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `tier=${result.tierLabel}\n`);
  }

  console.log(`PR governance validation passed with tier-${result.tierLabel} (implied tier-${result.impliedTier}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
