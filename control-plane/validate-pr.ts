import fs from 'node:fs';
import path from 'node:path';

type Tier = 0 | 1 | 2 | 3;
type TierString = '0' | '1' | '2' | '3';

const TIER_LABELS = ['tier-0', 'tier-1', 'tier-2', 'tier-3'] as const;
const TIER_VALUES = [0, 1, 2, 3] as const;
const EVIDENCE_FIELDS = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
] as const;
const REQUIRED_TIER0_CHECK = 'lint_tier0';
const REQUIRED_TIER3_CHECK = 'tier3_label_gate';

export interface RiskContract {
  tiers: Record<TierString, { description: string; required_checks: string[] }>;
  paths: Record<string, Tier>;
  default_tier: Tier;
}

export interface PullRequestData {
  body: string;
  labels: string[];
  changedFiles: string[];
}

export interface ValidationResult {
  ok: boolean;
  tierLabel?: Tier;
  tierBodyLabel?: Tier;
  tierBody?: Tier;
  impliedTier: Tier;
  requiredChecks: string[];
  escalationFiles: string[];
  errors: string[];
}

function isTier(value: unknown): value is Tier {
  return typeof value === 'number' && TIER_VALUES.includes(value as Tier);
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

export function extractTierLabelFromBody(body: string): Tier | undefined {
  const outsideFences = body.replace(/```[\s\S]*?```/g, '');
  const matches = Array.from(outsideFences.matchAll(/\btier-([0-3])\b/gi)).map((match) => match[1]);

  if (matches.length === 0) {
    return undefined;
  }

  const unique = [...new Set(matches)];
  if (unique.length > 1) {
    throw new Error(
      `Multiple unfenced tier declarations detected in PR body (${unique
        .map((tier) => `tier-${tier}`)
        .join(', ')}). Keep exactly one unfenced tier-* declaration.`
    );
  }

  return Number.parseInt(unique[0], 10) as Tier;
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

function validateEvidenceBlockSchema(body: string): {
  evidence?: Record<string, string>;
  errors: string[];
} {
  const match = body.match(/```evidence\s*([\s\S]*?)```/i);
  if (!match) {
    return {
      errors: [
        `Missing fenced evidence block. Paste:\n\n\`\`\`evidence\nRisk Tier: <0|1|2|3>\nJustification: <why this tier>\nAffected Paths: <comma-separated globs or file list>\nTests Added: <what you ran/added, or "N/A" with reason>\nDeterminism Statement: <why this change is deterministic and reproducible>\n\`\`\``
      ]
    };
  }

  const errors: string[] = [];
  const parsed: Record<string, string> = {};

  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      errors.push(`Evidence block line must use \`Key: Value\` format: ${trimmed}`);
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!EVIDENCE_FIELDS.includes(key as (typeof EVIDENCE_FIELDS)[number])) {
      errors.push(`Evidence block contains unsupported field: ${key}.`);
      continue;
    }
    if (parsed[key]) {
      errors.push(`Evidence block contains duplicate field: ${key}.`);
      continue;
    }
    if (!value) {
      errors.push(`Evidence block field must not be empty: ${key}.`);
      continue;
    }
    parsed[key] = value;
  }

  const missingFields = EVIDENCE_FIELDS.filter((field) => !parsed[field]);
  if (missingFields.length > 0) {
    errors.push(`Evidence block is missing required field(s): ${missingFields.join(', ')}.`);
  }

  return {
    evidence: errors.length === 0 ? parsed : parsed,
    errors
  };
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
    let matchedAnyRule = false;
    for (const rule of rules) {
      if (rule.regex.test(file)) {
        matchedAnyRule = true;
        if (rule.tier > fileTier) {
          fileTier = rule.tier;
        }
      }
    }
    if (!matchedAnyRule) {
      fileTier = contract.default_tier;
    }

    if (fileTier > impliedTier) {
      impliedTier = fileTier;
      escalationFiles = [file];
    } else if (fileTier === impliedTier && fileTier > 0) {
      escalationFiles.push(file);
    }
  }

  if (changedFiles.length === 0) {
    impliedTier = contract.default_tier;
  }

  return { impliedTier, escalationFiles };
}

export function getRequiredChecksForTier(tier: Tier, contract: RiskContract): string[] {
  return [...contract.tiers[String(tier) as TierString].required_checks];
}

export function assertValidRiskContract(contract: unknown): asserts contract is RiskContract {
  if (!contract || typeof contract !== 'object') {
    throw new Error('Invalid risk contract: root must be an object.');
  }

  const root = contract as Record<string, unknown>;
  const tiers = root.tiers;
  const paths = root.paths;
  const defaultTier = root.default_tier;

  if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) {
    throw new Error('Invalid risk contract: `tiers` must be an object.');
  }
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) {
    throw new Error('Invalid risk contract: `paths` must be an object.');
  }
  if (!isTier(defaultTier)) {
    throw new Error('Invalid risk contract: `default_tier` must be 0, 1, 2, or 3.');
  }

  const tierEntries = tiers as Record<string, unknown>;
  for (const tier of TIER_VALUES) {
    const key = String(tier) as TierString;
    const tierDef = tierEntries[key];
    if (!tierDef || typeof tierDef !== 'object' || Array.isArray(tierDef)) {
      throw new Error(`Invalid risk contract: missing tier definition for ${key}.`);
    }

    const tierObj = tierDef as Record<string, unknown>;
    if (typeof tierObj.description !== 'string' || tierObj.description.trim() === '') {
      throw new Error(`Invalid risk contract: tier ${key} must include a non-empty description.`);
    }

    if (!Array.isArray(tierObj.required_checks) || !tierObj.required_checks.every((c) => typeof c === 'string' && c.trim())) {
      throw new Error(`Invalid risk contract: tier ${key} must include string array \`required_checks\`.`);
    }

    const checks = tierObj.required_checks as string[];
    if (!checks.includes(REQUIRED_TIER0_CHECK)) {
      throw new Error(`Invalid risk contract: tier ${key} must include ${REQUIRED_TIER0_CHECK}.`);
    }
    if (tier === 3 && !checks.includes(REQUIRED_TIER3_CHECK)) {
      throw new Error(`Invalid risk contract: tier 3 must include ${REQUIRED_TIER3_CHECK}.`);
    }
  }

  for (const [glob, tierValue] of Object.entries(paths as Record<string, unknown>)) {
    if (!glob || typeof glob !== 'string') {
      throw new Error('Invalid risk contract: path glob keys must be non-empty strings.');
    }
    if (!isTier(tierValue)) {
      throw new Error(`Invalid risk contract: path mapping for ${glob} must be tier 0-3.`);
    }
  }
}

export function validatePrData(pr: PullRequestData, contract: RiskContract): ValidationResult {
  assertValidRiskContract(contract);
  const errors: string[] = [];
  let tierLabel: Tier | undefined;
  let tierBodyLabel: Tier | undefined;

  try {
    tierLabel = extractTierFromLabels(pr.labels);
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    tierBodyLabel = extractTierLabelFromBody(pr.body);
  } catch (error) {
    errors.push((error as Error).message);
  }

  const evidenceValidation = validateEvidenceBlockSchema(pr.body);
  const evidence = evidenceValidation.evidence;
  errors.push(...evidenceValidation.errors);
  const tierBody = extractTierFromEvidence(pr.body);
  const { impliedTier, escalationFiles } = inferImpliedTier(pr.changedFiles, contract);
  const requiredChecks = tierLabel !== undefined ? getRequiredChecksForTier(tierLabel, contract) : [];

  if (tierLabel === undefined) {
    errors.push(`Missing risk tier label. Add exactly one: ${TIER_LABELS.join(', ')}.`);
  }

  if (tierBodyLabel === undefined) {
    errors.push('Missing unfenced PR body tier declaration. Include exactly one plain-text `tier-0`..`tier-3` in the PR body.');
  }

  if (evidence && tierBody === undefined) {
    errors.push('Evidence block must include `Risk Tier: <0|1|2|3>`.');
  }

  if (tierLabel !== undefined && tierBodyLabel !== undefined && tierBodyLabel !== tierLabel) {
    errors.push(
      `Risk tier mismatch: labels are authoritative. Label tier is ${tierLabel}; update unfenced PR body declaration to tier-${tierLabel}.`
    );
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
    tierBodyLabel,
    tierBody,
    impliedTier,
    requiredChecks,
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
  const parsed = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as unknown;
  assertValidRiskContract(parsed);
  return parsed;
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
    fs.appendFileSync(outputPath, `detected_tier=${result.tierLabel}\n`);
    fs.appendFileSync(outputPath, `implied_tier=${result.impliedTier}\n`);
    fs.appendFileSync(outputPath, `required_checks=${result.requiredChecks.join(',')}\n`);
  }

  console.log(
    `PR governance validation passed with tier-${result.tierLabel} (implied tier-${result.impliedTier}). Required checks: ${result.requiredChecks.join(', ')}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
