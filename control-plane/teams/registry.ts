import type { TeamDefinition } from './types.ts';
import { validateTeamRegistry } from './schema.ts';

function sortOwnedPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export const TEAM_REGISTRY: TeamDefinition[] = validateTeamRegistry([
  {
    teamId: 'governance',
    executionMode: 'structured',
    ownedPaths: sortOwnedPaths(['control-plane/**', 'governance/**', '.github/**', 'infra/**']),
    description: 'Governance control plane, policy, CI/CD, and infra changes.'
  },
  {
    teamId: 'money-movement',
    executionMode: 'structured',
    ownedPaths: sortOwnedPaths([
      'packages/billing/**',
      'packages/payments/**',
      'adapters/**',
      'settlement/**',
      'wallet/**'
    ]),
    description: 'Billing, payments, custody, adapters, and settlement perimeter.'
  },
  {
    teamId: 'contracts',
    executionMode: 'structured',
    ownedPaths: sortOwnedPaths(['contracts/**', 'packages/contracts/**']),
    description: 'Contract artifacts and contract package changes.'
  },
  {
    teamId: 'product-app',
    executionMode: 'autonomous',
    ownedPaths: sortOwnedPaths(['apps/**', 'packages/ui/**', 'packages/frontend/**', 'packages/backend/**']),
    description: 'Application and product-facing package changes.'
  },
  {
    teamId: 'docs',
    executionMode: 'autonomous',
    ownedPaths: sortOwnedPaths(['docs/**']),
    description: 'Documentation changes.'
  }
]);
