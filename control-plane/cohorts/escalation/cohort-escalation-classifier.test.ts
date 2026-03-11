import { describe, expect, it } from 'vitest';

import { createCohortEscalationClassifier } from './cohort-escalation-classifier.ts';

function classifier(input: {
  healthState: 'healthy' | 'degraded' | 'conflicted' | 'unstable';
  readinessState: 'pending' | 'active' | 'incomplete' | 'inconclusive' | 'ready' | 'completed';
  synthesisInconclusive?: boolean;
  degradedInvestigations?: number;
  adverseSignals?: number;
}) {
  const adverseSignals = Array.from({ length: input.adverseSignals ?? 0 }, (_, index) => ({
    signalType: 'protocol_risk',
    sourceMission: 'm',
    dataset: 'd',
    metadata: { protocol: 'Aave' },
    slot: `daily:2026-03-${String(10 + index).padStart(2, '0')}`,
    dedupeKey: `sig-${index}`,
    logDate: '2026-03-11'
  }));

  return createCohortEscalationClassifier({
    cohortProjection: {
      projectOne: () => ({
        cohortId: 'aave-risk',
        cohort: {
          cohortId: 'aave-risk',
          cohortType: 'protocol-risk',
          subjectKey: 'protocol:aave',
          linkedInvestigations: Array.from({ length: input.degradedInvestigations ?? 0 }, (_, index) => `inv-${index}`),
          linkedSyntheses: input.synthesisInconclusive ? ['syn-1'] : [],
          readinessState: input.readinessState,
          healthState: input.healthState,
          strengths: [],
          limitations: []
        },
        conflicts: [],
        reportPreview: {},
        statusPreview: {}
      })
    } as any,
    synthesisInspection: {
      inspectStatus: () => ({ readinessState: 'inconclusive' })
    } as any,
    investigationInspection: {
      inspectCompletionStatus: () => ({ healthState: 'degraded' })
    } as any,
    signalStore: {
      listSignals: () => adverseSignals
    } as any,
    programRegistry: {
      listPrograms: () => [{ programId: 'aave-risk-monitor', cohortId: 'aave-risk' }]
    } as any,
    now: () => new Date('2026-03-11T12:00:00.000Z')
  });
}

describe('cohort escalation classifier', () => {
  it('T-CE-1 classifies none deterministically when stable inputs have no adverse context', () => {
    const projection = classifier({
      healthState: 'healthy',
      readinessState: 'ready'
    }).classifyCohort({ cohortId: 'aave-risk', slotOrReference: 'daily:2026-03-11' });

    expect(projection.escalationState).toBe('none');
    expect(projection.escalationReasons).toEqual([]);
  });

  it('T-CE-2 classifies elevated for degraded health and single adverse window', () => {
    const projection = classifier({
      healthState: 'degraded',
      readinessState: 'incomplete',
      adverseSignals: 1
    }).classifyCohort({ cohortId: 'aave-risk', slotOrReference: 'daily:2026-03-11' });

    expect(projection.escalationState).toBe('elevated');
    expect(projection.escalationReasons).toContain('cohort_health_degraded');
  });

  it('T-CE-3 classifies escalated for conflicted or repeated degradation reasons', () => {
    const projection = classifier({
      healthState: 'conflicted',
      readinessState: 'inconclusive',
      degradedInvestigations: 2,
      synthesisInconclusive: true,
      adverseSignals: 3
    }).classifyCohort({ cohortId: 'aave-risk', slotOrReference: 'daily:2026-03-11' });

    expect(projection.escalationState).toBe('escalated');
    expect(projection.escalationReasons).toContain('repeated_adverse_signals_escalated_window');
  });

  it('T-CE-4 classifies critical for unstable or critical adverse windows', () => {
    const projection = classifier({
      healthState: 'unstable',
      readinessState: 'inconclusive',
      adverseSignals: 6
    }).classifyCohort({ cohortId: 'aave-risk', slotOrReference: 'daily:2026-03-11' });

    expect(projection.escalationState).toBe('critical');
    expect(projection.escalationReasons).toContain('cohort_health_unstable');
  });
});
