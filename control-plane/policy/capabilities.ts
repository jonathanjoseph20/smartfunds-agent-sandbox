import type { CapabilityClass, PolicyProfile } from './types.ts';

export const PROFILE_CAPABILITIES: Record<PolicyProfile, CapabilityClass[]> = {
  build: [
    'artifact_write',
    'pr_open',
    'read',
    'repo_write'
  ],
  core: [
    'artifact_write',
    'pr_open',
    'protected_write',
    'read',
    'repo_write'
  ],
  lite: ['artifact_write', 'read']
};
