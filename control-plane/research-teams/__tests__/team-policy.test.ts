import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTeamPolicyRegistry, loadTeamResponsePolicies } from '../coordination/team-policy-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-policy-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team policy registry', () => {
  it('T-RT-CP1 loads policies in deterministic order', () => {
    writeJson('zeta.json', {
      teamId: 'zeta-team',
      routingRules: [{ cohort: 'c-2', investigationTemplate: 'i-2' }],
      priorityRules: { escalated: 'high', conflicted: 'critical', failure: 'high' },
      stabilizationRules: { requiredHealthySlots: 2, requireResolvedInvestigations: true, requireClearedConflicts: true }
    });
    writeJson('alpha.json', {
      teamId: 'alpha-team',
      routingRules: [
        { cohort: 'c-2', investigationTemplate: 'i-2' },
        { cohort: 'c-1', investigationTemplate: 'i-1' }
      ],
      priorityRules: { escalated: 'high', conflicted: 'critical', failure: 'high' },
      stabilizationRules: { requiredHealthySlots: 3, requireResolvedInvestigations: true, requireClearedConflicts: true }
    });

    const policies = loadTeamResponsePolicies({ definitionsDir: tmpRoot });
    expect(policies.map((entry) => entry.teamId)).toEqual(['alpha-team', 'zeta-team']);
    expect(policies[0]?.routingRules).toEqual([
      { cohort: 'c-1', investigationTemplate: 'i-1' },
      { cohort: 'c-2', investigationTemplate: 'i-2' }
    ]);
  });

  it('T-RT-CP2 rejects unknown priority enum values', () => {
    writeJson('invalid.json', {
      teamId: 'bad-team',
      routingRules: [{ cohort: 'c-1', investigationTemplate: 'i-1' }],
      priorityRules: { escalated: 'urgent', conflicted: 'critical', failure: 'high' },
      stabilizationRules: { requiredHealthySlots: 1, requireResolvedInvestigations: true, requireClearedConflicts: true }
    });

    expect(() => loadTeamResponsePolicies({ definitionsDir: tmpRoot })).toThrow(/must be one of/);
  });

  it('T-RT-CP3 rejects duplicate team ids', () => {
    writeJson('a.json', {
      teamId: 'dup-team',
      routingRules: [{ cohort: 'c-1', investigationTemplate: 'i-1' }],
      priorityRules: { escalated: 'high', conflicted: 'critical', failure: 'high' },
      stabilizationRules: { requiredHealthySlots: 1, requireResolvedInvestigations: true, requireClearedConflicts: true }
    });
    writeJson('b.json', {
      teamId: 'dup-team',
      routingRules: [{ cohort: 'c-2', investigationTemplate: 'i-2' }],
      priorityRules: { escalated: 'high', conflicted: 'critical', failure: 'high' },
      stabilizationRules: { requiredHealthySlots: 1, requireResolvedInvestigations: true, requireClearedConflicts: true }
    });

    expect(() => createTeamPolicyRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate team policy/);
  });
});
