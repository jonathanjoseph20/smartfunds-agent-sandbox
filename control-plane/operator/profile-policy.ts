import { PROFILE_CAPABILITIES } from '../policy/capabilities.ts';
import type { CapabilityClass, PolicyProfile } from '../policy/types.ts';
import { validateProfileRequest } from '../policy/profile-validation.ts';
import type { MissionDefinition } from '../missions/mission-types.ts';
import { ProfilePolicyError, type ProfileErrorCode } from './profile-errors.ts';

export type ExecutionPath = 'governed' | 'lite';

const POLICY_PROFILES: readonly PolicyProfile[] = ['lite', 'build', 'core'] as const;

const LITE_FORBIDDEN_TASK_PATTERNS: Array<{ pattern: RegExp; code: ProfileErrorCode; reason: string }> = [
  { pattern: /^repo$/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot execute repo mutation tasks.' },
  { pattern: /^shell$/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot execute shell mutation tasks.' },
  { pattern: /(^|[._-])pr([._-]|$)/i, code: 'LITE_PR_OPEN_FORBIDDEN', reason: 'Lite missions cannot open PR workflows.' },
  { pattern: /protected[_-]?write/i, code: 'LITE_PROTECTED_WRITE_FORBIDDEN', reason: 'Lite missions cannot use protected write workflows.' },
  { pattern: /deploy/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot execute deploy workflows.' },
  { pattern: /repo[_-]?write/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot execute repo write workflows.' },
  { pattern: /create[_-]?branch/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot create branches.' },
  { pattern: /commit/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot execute commit workflows.' },
  { pattern: /patch/i, code: 'LITE_REPO_MUTATION_FORBIDDEN', reason: 'Lite missions cannot execute patch workflows.' }
];

function isPolicyProfile(value: string): value is PolicyProfile {
  return POLICY_PROFILES.includes(value as PolicyProfile);
}

function normalizeProfile(value: unknown): PolicyProfile {
  if (typeof value !== 'string' || !isPolicyProfile(value)) {
    throw new ProfilePolicyError('PROFILE_INVALID', 'Mission profile must be one of lite, build, core.');
  }
  return value;
}

function mapCapabilityDenial(capability: CapabilityClass): ProfilePolicyError {
  if (capability === 'repo_write') {
    return new ProfilePolicyError('LITE_REPO_MUTATION_FORBIDDEN', 'Lite missions cannot request repo_write.');
  }
  if (capability === 'pr_open') {
    return new ProfilePolicyError('LITE_PR_OPEN_FORBIDDEN', 'Lite missions cannot request pr_open.');
  }
  if (capability === 'protected_write') {
    return new ProfilePolicyError('LITE_PROTECTED_WRITE_FORBIDDEN', 'Lite missions cannot request protected_write.');
  }
  return new ProfilePolicyError('PROFILE_CAPABILITY_DENIED', `Lite missions cannot request ${capability}.`);
}

function extractDeniedCapability(violations: string[]): CapabilityClass | null {
  const denied = violations
    .find((violation) => violation.startsWith('profile_lite_disallows_') && !violation.includes('mutation_intent'));

  if (!denied) {
    return null;
  }

  const capability = denied.replace('profile_lite_disallows_', '');
  if (
    capability === 'read'
    || capability === 'artifact_write'
    || capability === 'repo_write'
    || capability === 'pr_open'
    || capability === 'protected_write'
  ) {
    return capability;
  }

  return null;
}

export function resolveExecutionProfile(input: {
  mission: MissionDefinition;
  requestedProfile?: string;
}): { profile: PolicyProfile; executionPath: ExecutionPath; allowedCapabilities: CapabilityClass[] } {
  const declared = input.mission.profile;
  if (declared !== undefined && !isPolicyProfile(declared)) {
    throw new ProfilePolicyError('PROFILE_INVALID', `Mission ${input.mission.missionId} profile is invalid.`);
  }

  if (declared && input.requestedProfile && declared !== input.requestedProfile) {
    throw new ProfilePolicyError(
      'PROFILE_EXECUTION_PATH_REQUIRED',
      `Mission ${input.mission.missionId} declares profile ${declared} and cannot run as ${input.requestedProfile}.`
    );
  }

  const effective = input.requestedProfile
    ? normalizeProfile(input.requestedProfile)
    : declared ?? 'core';

  return {
    profile: effective,
    executionPath: effective === 'lite' ? 'lite' : 'governed',
    allowedCapabilities: [...PROFILE_CAPABILITIES[effective]].sort((left, right) => left.localeCompare(right))
  };
}

export function assertProfileCapabilities(input: {
  mission: MissionDefinition;
  profile: PolicyProfile;
}): void {
  const validation = validateProfileRequest({
    profile: input.profile,
    requestedCapabilities: input.mission.requestedCapabilities ?? [],
    mutationIntent: input.mission.mutationIntent ?? 'none',
    targetScope: input.mission.targetScope
  });

  if (validation.ok) {
    return;
  }

  if (input.profile === 'lite') {
    const deniedCapability = extractDeniedCapability(validation.violations);
    if (deniedCapability) {
      throw mapCapabilityDenial(deniedCapability);
    }
  }

  if (validation.violations.some((violation) => violation.startsWith('unknown_profile_'))) {
    throw new ProfilePolicyError('PROFILE_INVALID', `Unsupported mission profile: ${input.profile}.`);
  }

  throw new ProfilePolicyError(
    'PROFILE_CAPABILITY_DENIED',
    `Profile ${input.profile} is incompatible with requested capabilities: ${validation.violations.join(', ')}`
  );
}

export function assertLiteTaskAllowed(task: string): void {
  const normalized = task.trim();
  for (const entry of LITE_FORBIDDEN_TASK_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      throw new ProfilePolicyError(entry.code, entry.reason);
    }
  }
}

export function assertLiteWorkflowTasks(workflowTasks: string[]): void {
  for (const task of [...workflowTasks].sort((left, right) => left.localeCompare(right))) {
    assertLiteTaskAllowed(task);
  }
}

