import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';
import { type Tier, extractTierFromLabels } from './diagnostics.ts';
import { normalizeChangedFiles } from './changed-files.ts';

export const DEFAULT_DETERMINISM_STATEMENT =
  'Deterministic evidence generation from PR metadata using canonical JSON and stable ordering.';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function resolveEvidenceTierFromLabels(labels: string[]): Tier {
  const tier = extractTierFromLabels(sortedUnique(labels));
  if (tier === undefined) {
    throw new Error('Missing risk tier label. Add exactly one label: tier-0, tier-1, tier-2, tier-3.');
  }
  return tier;
}

export function resolveEvidenceModeFromChangedFiles(changedFiles: string[]): EvidenceMode {
  const resolution = resolveTeamsForChangedFiles(changedFiles);
  const implied = resolveImpliedExecutionMode(resolution.executionModesTouched);
  if (implied !== null) {
    return implied;
  }

  const sortedModes = [...resolution.executionModesTouched].sort((left, right) => left.localeCompare(right));
  if (sortedModes[0] === 'autonomous') {
    return 'autonomous';
  }
  return 'structured';
}

// Paths excluded from affectedPaths to avoid self-referential evidence cycles.
// Must match the sanitizeAffectedPaths filter in control-plane/cli/governance-emit.ts.
const EVIDENCE_SELF_REFERENTIAL_PATHS = new Set(['governance/evidence.json', 'governance/evidence.js']);

export function generateEvidenceFromPullRequestMetadata(input: {
  labels: string[];
  changedFiles: string[];
  determinismStatement?: string;
  retrySemanticsModified?: boolean;
  autonomyScopeExpanded?: boolean;
}): GovernanceEvidence {
  const changedFiles = normalizeChangedFiles(
    input.changedFiles.filter((f) => !EVIDENCE_SELF_REFERENTIAL_PATHS.has(f))
  );
  return buildCanonicalEvidence({
    tier: resolveEvidenceTierFromLabels(input.labels),
    mode: resolveEvidenceModeFromChangedFiles(changedFiles),
    affectedPaths: changedFiles,
    determinismStatement: input.determinismStatement ?? DEFAULT_DETERMINISM_STATEMENT,
    retrySemanticsModified: input.retrySemanticsModified ?? false,
    autonomyScopeExpanded: input.autonomyScopeExpanded ?? false
  });
}

export function buildGovernanceMetadataSnapshot(input: {
  pr: number;
  labels: string[];
  files: string[];
  evidence: GovernanceEvidence;
}): {
  pr: number;
  labels: string[];
  filesHash: string;
  evidenceHash: string;
} {
  const labels = sortedUnique(input.labels);
  const files = normalizeChangedFiles(input.files);
  const filesHash = sha256(canonicalStringify(files));
  const evidenceHash = sha256(canonicalStringify(input.evidence));

  return {
    pr: input.pr,
    labels,
    filesHash,
    evidenceHash
  };
}

export function stringifyGovernanceMetadataSnapshot(snapshot: {
  pr: number;
  labels: string[];
  filesHash: string;
  evidenceHash: string;
}): string {
  return JSON.stringify({
    pr: snapshot.pr,
    labels: snapshot.labels,
    filesHash: snapshot.filesHash,
    evidenceHash: snapshot.evidenceHash
  });
}
