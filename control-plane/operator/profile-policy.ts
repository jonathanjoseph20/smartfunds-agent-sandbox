import { PROFILE_CAPABILITIES } from '../policy/capabilities.ts';
import type { CapabilityClass, MutationIntent, PolicyProfile } from '../policy/types.ts';
import { validateProfileRequest } from '../policy/profile-validation.ts';
import type { MissionDefinition } from '../missions/mission-types.ts';
import { ProfilePolicyError, type ProfileErrorCode } from './profile-errors.ts';

export type ExecutionPath = 'governed' | 'lite' | 'build';

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

const BUILD_ALLOWED_MUTATION_INTENTS: readonly MutationIntent[] = [
  'none',
  'artifact',
  'code_change',
  'ui_change',
  'product_update',
  'tooling_change'
] as const;

const BUILD_PROTECTED_PATH_PREFIXES = [
  'control-plane/',
  'entities/',
  'runtime/',
  'policies/'
] as const;

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

function mapBuildCapabilityDenial(capability: CapabilityClass): ProfilePolicyError {
  if (capability === 'protected_write') {
    return new ProfilePolicyError('BUILD_PROTECTED_WRITE_FORBIDDEN', 'Build missions cannot request protected_write.');
  }
  if (capability === 'repo_write') {
    return new ProfilePolicyError('BUILD_REPO_WRITE_REQUIRED', 'Build missions require repo_write.');
  }
  if (capability === 'pr_open') {
    return new ProfilePolicyError('BUILD_PR_OPEN_REQUIRED', 'Build missions require pr_open.');
  }
  return new ProfilePolicyError('PROFILE_CAPABILITY_DENIED', `Build missions cannot request ${capability}.`);
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

function isBuildProtectedPath(pathValue: string): boolean {
  const normalized = pathValue.trim();
  return BUILD_PROTECTED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
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
    executionPath: effective === 'lite'
      ? 'lite'
      : effective === 'build'
        ? 'build'
        : 'governed',
    allowedCapabilities: [...PROFILE_CAPABILITIES[effective]].sort((left, right) => left.localeCompare(right))
  };
}

export function assertProfileCapabilities(input: {
  mission: MissionDefinition;
  profile: PolicyProfile;
}): void {
  if (input.profile === 'build') {
    if (!input.mission.targetScope || input.mission.targetScope.paths === undefined || input.mission.targetScope.paths.length === 0) {
      throw new ProfilePolicyError('BUILD_TARGET_SCOPE_DENIED', 'Build missions must declare a targetScope with at least one path.');
    }

    const requested = new Set(input.mission.requestedCapabilities ?? []);
    if (!requested.has('repo_write')) {
      throw new ProfilePolicyError('BUILD_REPO_WRITE_REQUIRED', 'Build missions must request repo_write.');
    }
    if (!requested.has('pr_open')) {
      throw new ProfilePolicyError('BUILD_PR_OPEN_REQUIRED', 'Build missions must request pr_open.');
    }

    const mutationIntent = input.mission.mutationIntent ?? 'none';
    if (!BUILD_ALLOWED_MUTATION_INTENTS.includes(mutationIntent)) {
      throw new ProfilePolicyError(
        'BUILD_MUTATION_INTENT_FORBIDDEN',
        `Build missions cannot request mutationIntent=${mutationIntent}.`
      );
    }

    const requestedPaths = input.mission.targetScope?.paths ?? [];
    const protectedPath = requestedPaths.find((entry) => isBuildProtectedPath(entry));
    if (protectedPath) {
      throw new ProfilePolicyError(
        'BUILD_PROTECTED_SCOPE_FORBIDDEN',
        `Build missions cannot target protected path: ${protectedPath}.`
      );
    }
  }

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

  if (input.profile === 'build') {
    const buildCapabilityDenial = validation.violations
      .find((violation) => violation.startsWith('profile_build_disallows_') && !violation.includes('mutation_intent'))
      ?.replace('profile_build_disallows_', '');

    if (
      buildCapabilityDenial === 'read'
      || buildCapabilityDenial === 'artifact_write'
      || buildCapabilityDenial === 'repo_write'
      || buildCapabilityDenial === 'pr_open'
      || buildCapabilityDenial === 'protected_write'
    ) {
      throw mapBuildCapabilityDenial(buildCapabilityDenial);
    }

    const deniedPathViolation = validation.violations
      .find((violation) => violation.startsWith('profile_build_disallows_target_path_'));
    if (deniedPathViolation) {
      const deniedPath = deniedPathViolation.replace('profile_build_disallows_target_path_', '');
      const code = isBuildProtectedPath(deniedPath)
        ? 'BUILD_PROTECTED_SCOPE_FORBIDDEN'
        : 'BUILD_TARGET_SCOPE_DENIED';
      throw new ProfilePolicyError(code, `Build missions cannot target path: ${deniedPath}.`);
    }

    if (validation.violations.includes('profile_build_disallows_target_repo')) {
      throw new ProfilePolicyError(
        'BUILD_TARGET_SCOPE_DENIED',
        'Build missions cannot target the requested repository.'
      );
    }

    const mutationViolation = validation.violations
      .find((violation) => violation.startsWith('profile_build_disallows_mutation_intent_'));
    if (mutationViolation) {
      const deniedIntent = mutationViolation.replace('profile_build_disallows_mutation_intent_', '');
      throw new ProfilePolicyError(
        'BUILD_MUTATION_INTENT_FORBIDDEN',
        `Build missions cannot request mutationIntent=${deniedIntent}.`
      );
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
