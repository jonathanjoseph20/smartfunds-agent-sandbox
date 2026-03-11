import { describe, expect, it } from 'vitest';

import { projectCohortLifecycleState, projectProgramLifecycleState } from './program-lifecycle.ts';
import type { CohortProgramDefinition } from './program-types.ts';

function program(lifecycleState: CohortProgramDefinition['lifecycleState'], enabled = true): CohortProgramDefinition {
  return {
    programId: 'aave-risk-monitor',
    cohortId: 'aave-risk',
    displayName: 'Aave Risk Monitor',
    cadence: 'daily',
    enabled,
    lifecycleState,
    investigationTemplates: ['protocol-risk-investigation'],
    launchConditions: [{ kind: 'cadence' }]
  };
}

describe('cohort program lifecycle projection', () => {
  it('T-CP-LIFE1 program lifecycle projects pending/active/paused/completed deterministically', () => {
    expect(projectProgramLifecycleState({
      definition: program('pending', true),
      historyEntries: []
    })).toBe('pending');

    expect(projectProgramLifecycleState({
      definition: program('active', true),
      historyEntries: [{
        evaluatedSlot: 'daily:2026-03-11',
        logDate: '2026-03-11',
        lifecycleState: 'active',
        matchedConditionKinds: ['cadence'],
        launches: []
      }]
    })).toBe('active');

    expect(projectProgramLifecycleState({
      definition: program('active', false),
      historyEntries: []
    })).toBe('paused');

    expect(projectProgramLifecycleState({
      definition: program('completed', true),
      historyEntries: []
    })).toBe('completed');
  });

  it('T-CP-LIFE2 cohort lifecycle precedence is explicit and stable', () => {
    expect(projectCohortLifecycleState({
      programLifecycleStates: ['pending'],
      cohortHealthState: 'healthy',
      linkedInvestigationStatuses: [],
      escalationConditionSatisfied: false
    })).toBe('inactive');

    expect(projectCohortLifecycleState({
      programLifecycleStates: ['active'],
      cohortHealthState: 'degraded',
      linkedInvestigationStatuses: ['running'],
      escalationConditionSatisfied: true
    })).toBe('investigating');

    expect(projectCohortLifecycleState({
      programLifecycleStates: ['active'],
      cohortHealthState: 'conflicted',
      linkedInvestigationStatuses: [],
      escalationConditionSatisfied: true
    })).toBe('escalated');

    expect(projectCohortLifecycleState({
      programLifecycleStates: ['active'],
      cohortHealthState: 'degraded',
      linkedInvestigationStatuses: [],
      escalationConditionSatisfied: false
    })).toBe('monitoring');

    expect(projectCohortLifecycleState({
      programLifecycleStates: ['active'],
      cohortHealthState: 'healthy',
      linkedInvestigationStatuses: [],
      escalationConditionSatisfied: false
    })).toBe('stable');
  });
});
