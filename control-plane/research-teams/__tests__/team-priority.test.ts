import { describe, expect, it } from 'vitest';

import { evaluateTeamPriority } from '../coordination/team-priority-engine.ts';

const rules = {
  escalated: 'high',
  conflicted: 'critical',
  failure: 'high'
} as const;

describe('team priority engine', () => {
  it('T-RT-CPR1 classifies synthesis conflict as critical priority', () => {
    const priority = evaluateTeamPriority({
      teamId: 'defi-risk-team',
      priorityRules: rules,
      hasEscalation: true,
      hasInvestigationFailure: true,
      hasSynthesisConflict: true
    });

    expect(priority.priority).toBe('critical');
    expect(priority.appliedRule).toBe('conflicted');
  });

  it('T-RT-CPR2 classifies escalation as high priority', () => {
    const priority = evaluateTeamPriority({
      teamId: 'defi-risk-team',
      priorityRules: rules,
      hasEscalation: true,
      hasInvestigationFailure: false,
      hasSynthesisConflict: false
    });

    expect(priority.priority).toBe('high');
    expect(priority.appliedRule).toBe('escalated');
  });

  it('T-RT-CPR3 degrades deterministically to signal severity and normal fallback', () => {
    const fromSignal = evaluateTeamPriority({
      teamId: 'defi-risk-team',
      priorityRules: rules,
      hasEscalation: false,
      hasInvestigationFailure: false,
      hasSynthesisConflict: false,
      signalSeverity: 'low'
    });
    const defaulted = evaluateTeamPriority({
      teamId: 'defi-risk-team',
      priorityRules: rules,
      hasEscalation: false,
      hasInvestigationFailure: false,
      hasSynthesisConflict: false
    });

    expect(fromSignal.priority).toBe('normal');
    expect(fromSignal.appliedRule).toBe('signal_severity');
    expect(defaulted.priority).toBe('normal');
    expect(defaulted.appliedRule).toBe('default');
  });
});
