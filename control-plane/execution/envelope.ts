import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { loadProjectsFromDir, loadTeamsFromDir } from '../studio/registry.ts';
import { resolveOwnership, type OwnershipResult } from '../studio/ownership.ts';
import type { ErrorClass } from './error-classification.ts';

export type EnvelopeIdentityV1 = {
  triggerType: 'manual' | 'ci_failure' | 'webhook' | 'preflight';
  repo: { owner: string; name: string };
  ref: { base: string; head: string };
  diff: {
    changedPaths: string[];
    projectIdsTouched: string[];
    teamIdsTouched: string[];
    ownershipStatus: 'ok' | 'no_work' | 'violation';
  };
  policy: {
    declaredTier: number;
    impliedTier: number;
    executionMode: 'structured' | 'autonomous';
  };
  failure: {
    errorClass: ErrorClass | null;
    failureSignature: string | null;
  };
};

type EnvelopeResolverDeps = {
  loadProjects?: typeof loadProjectsFromDir;
  loadTeams?: typeof loadTeamsFromDir;
  resolveOwnership?: typeof resolveOwnership;
};

export const ENVELOPE_ERROR_CODES = {
  ENVELOPE_HASH_MISMATCH: 'ERR_ENVELOPE_HASH_MISMATCH'
} as const;

export class EnvelopeMismatchError extends Error {
  public readonly code = ENVELOPE_ERROR_CODES.ENVELOPE_HASH_MISMATCH;

  constructor(expectedEnvelopeHash: string, receivedEnvelopeHash: string) {
    super(`Envelope hash mismatch: expected=${expectedEnvelopeHash} received=${receivedEnvelopeHash}`);
    this.name = 'EnvelopeMismatchError';
  }
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function toEnvelopeOwnershipStatus(ownership: OwnershipResult['ownershipStatus']): 'ok' | 'violation' {
  return ownership === 'ok' ? 'ok' : 'violation';
}

function resolveDiffScope(changedPaths: string[], deps: EnvelopeResolverDeps): {
  projectIdsTouched: string[];
  teamIdsTouched: string[];
  ownershipStatus: 'ok' | 'no_work' | 'violation';
} {
  const orderedPaths = sortedUnique(changedPaths);
  if (orderedPaths.length === 0) {
    return {
      projectIdsTouched: [],
      teamIdsTouched: [],
      ownershipStatus: 'no_work'
    };
  }

  const loadProjects = deps.loadProjects ?? loadProjectsFromDir;
  const loadTeams = deps.loadTeams ?? loadTeamsFromDir;
  const resolveOwnershipFn = deps.resolveOwnership ?? resolveOwnership;

  const projects = loadProjects('control-plane/projects');
  const teams = loadTeams('control-plane/teams', projects);
  const ownership = resolveOwnershipFn({
    changedFiles: orderedPaths,
    projects,
    teams
  });

  return {
    projectIdsTouched: sortedUnique(ownership.projectsTouched),
    teamIdsTouched: sortedUnique(ownership.teamsTouched),
    ownershipStatus: toEnvelopeOwnershipStatus(ownership.ownershipStatus)
  };
}

export function buildEnvelopeIdentityV1(input: {
  triggerType: EnvelopeIdentityV1['triggerType'];
  repo: EnvelopeIdentityV1['repo'];
  ref: EnvelopeIdentityV1['ref'];
  changedPaths: string[];
  declaredTier: number;
  impliedTier: number;
  executionMode: EnvelopeIdentityV1['policy']['executionMode'];
  errorClass?: ErrorClass | null;
  failureSignature?: string | null;
}, deps: EnvelopeResolverDeps = {}): EnvelopeIdentityV1 {
  const orderedPaths = sortedUnique(input.changedPaths);
  const diffScope = resolveDiffScope(orderedPaths, deps);

  return {
    triggerType: input.triggerType,
    repo: {
      owner: input.repo.owner,
      name: input.repo.name
    },
    ref: {
      base: input.ref.base,
      head: input.ref.head
    },
    diff: {
      changedPaths: orderedPaths,
      projectIdsTouched: diffScope.projectIdsTouched,
      teamIdsTouched: diffScope.teamIdsTouched,
      ownershipStatus: diffScope.ownershipStatus
    },
    policy: {
      declaredTier: input.declaredTier,
      impliedTier: input.impliedTier,
      executionMode: input.executionMode
    },
    failure: {
      errorClass: input.errorClass ?? null,
      failureSignature: input.failureSignature ?? null
    }
  };
}

export function computeEnvelopeHash(envelopeIdentity: EnvelopeIdentityV1): string {
  return sha256(canonicalStringify(envelopeIdentity));
}

export function computeRunId(envelopeHash: string): string {
  return sha256(envelopeHash);
}

export function assertEnvelopeHashMatch(expectedEnvelopeHash: string, receivedEnvelopeHash: string): void {
  if (expectedEnvelopeHash !== receivedEnvelopeHash) {
    throw new EnvelopeMismatchError(expectedEnvelopeHash, receivedEnvelopeHash);
  }
}
