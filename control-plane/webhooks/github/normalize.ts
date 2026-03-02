import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import { classifyFailure } from './classify.ts';
import type {
  CiContextResolver,
  CiFailureEnvelope,
  EnvelopeConclusion,
  ResolvedCiContext,
  SupportedGithubEventType
} from './types.ts';

function normalizeRepository(value: unknown): string {
  if (typeof value !== 'string') {
    return 'unknown/unknown';
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : 'unknown/unknown';
}

function normalizeConclusion(value: unknown): EnvelopeConclusion {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (normalized === 'success') {
    return 'success';
  }
  if (normalized === 'failure' || normalized === 'failed') {
    return 'failure';
  }
  if (normalized === 'cancelled') {
    return 'cancelled';
  }
  if (normalized === 'timed_out') {
    return 'timed_out';
  }

  return 'neutral';
}

function normalizeCheckName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function extractPrNumber(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const candidate = value[0] as { number?: unknown };
  return typeof candidate?.number === 'number' ? candidate.number : null;
}

function ensureHeadSha(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('invalid_payload: missing_head_sha');
  }

  return value.trim();
}

export const defaultCiContextResolver: CiContextResolver = (input) => {
  return {
    prNumber: input.prNumber,
    tier: null,
    executionMode: null,
    entityIds: [],
    railBindingStatus: 'unknown',
    retryCount: 0,
    runId: null
  };
};

export function normalizeGithubEvent(input: {
  eventType: SupportedGithubEventType;
  deliveryId: string;
  payload: unknown;
  contextResolver?: CiContextResolver;
}): {
  envelope: CiFailureEnvelope;
  context: ResolvedCiContext;
} {
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  const repository = normalizeRepository((payload.repository as { full_name?: unknown } | undefined)?.full_name);

  let checkName = 'unknown-check';
  let prNumber: number | null = null;
  let headSha = '';
  let conclusion: EnvelopeConclusion = 'neutral';

  if (input.eventType === 'check_run') {
    const checkRun = (payload.check_run ?? {}) as Record<string, unknown>;
    checkName = normalizeCheckName(checkRun.name, 'unknown-check');
    prNumber = extractPrNumber(checkRun.pull_requests);
    headSha = ensureHeadSha(checkRun.head_sha ?? (checkRun.check_suite as { head_sha?: unknown } | undefined)?.head_sha);
    conclusion = normalizeConclusion(checkRun.conclusion ?? checkRun.status);
  }

  if (input.eventType === 'workflow_run') {
    const workflowRun = (payload.workflow_run ?? {}) as Record<string, unknown>;
    checkName = normalizeCheckName(workflowRun.name, 'unknown-workflow');
    prNumber = extractPrNumber(workflowRun.pull_requests);
    headSha = ensureHeadSha(workflowRun.head_sha);
    conclusion = normalizeConclusion(workflowRun.conclusion ?? workflowRun.status);
  }

  const resolver = input.contextResolver ?? defaultCiContextResolver;
  const context = resolver({
    eventType: input.eventType,
    payload,
    repository,
    prNumber,
    headSha
  });

  const envelopeWithoutHash: Omit<CiFailureEnvelope, 'normalizedHash'> = {
    envelopeVersion: 1,
    eventType: input.eventType,
    githubDeliveryId: input.deliveryId,
    repository,
    prNumber: context.prNumber,
    headSha,
    checkName,
    conclusion,
    failureClass: classifyFailure({ checkName }),
    tier: context.tier,
    executionMode: context.executionMode,
    entityIds: [...context.entityIds],
    railBindingStatus: context.railBindingStatus
  };

  const normalizedHash = sha256(canonicalStringify(envelopeWithoutHash));

  return {
    envelope: {
      ...envelopeWithoutHash,
      normalizedHash
    },
    context
  };
}
