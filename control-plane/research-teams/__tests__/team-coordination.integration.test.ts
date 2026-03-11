import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTeamCoordinationEngine } from '../coordination/team-coordination-engine.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-coordination');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team coordination integration', () => {
  it('T-RT-CI1 runs deterministic response coordination from escalation to resolution without changing bounded status semantics', () => {
    let phase: 'escalated' | 'stabilizing' | 'resolved' = 'escalated';

    const engine = createTeamCoordinationEngine({
      teamRegistry: {
        getResearchTeam: () => ({
          teamId: 'defi-risk-team',
          displayName: 'DeFi Risk Research Team',
          teamType: 'risk_monitoring',
          enabled: true,
          attachmentRules: { cohortIds: ['aave-risk'] }
        })
      } as any,
      teamStatusEvaluator: {
        evaluateTeamStatus: () => ({
          teamId: 'defi-risk-team',
          activityState: phase === 'escalated' ? 'escalated_response' : 'monitoring',
          healthState: phase === 'escalated' ? 'conflicted' : 'healthy',
          linkedCohortIds: ['aave-risk'],
          linkedProgramIds: ['aave-risk-monitor'],
          linkedInvestigationIds: ['inv-1'],
          linkedSynthesisIds: ['syn-1'],
          responseReasons: phase === 'escalated' ? ['cohort_escalated'] : ['no_escalation_signals']
        })
      } as any,
      cohortInspection: {
        inspectCohortEscalation: () => ({
          cohortId: 'aave-risk',
          escalationState: phase === 'escalated' ? 'escalated' : 'none'
        }),
        inspectStatus: () => ({
          cohortId: 'aave-risk',
          readiness: phase === 'escalated' ? 'active' : 'ready',
          health: phase === 'escalated' ? 'degraded' : 'healthy'
        })
      } as any,
      investigationInspection: {
        inspectCompletionStatus: () => ({
          investigationRunId: 'inv-1',
          readinessState: phase === 'resolved' ? 'complete' : 'inconclusive',
          convergenceState: phase === 'resolved' ? 'converged' : 'inconclusive',
          healthState: phase === 'escalated' ? 'degraded' : 'healthy',
          blockingReasons: [],
          strengths: [],
          limitations: []
        })
      } as any,
      synthesisInspection: {
        inspectConflicts: () => ({
          synthesisId: 'syn-1',
          conflicts: phase === 'escalated' ? [{ id: 'c-1' }] : []
        })
      } as any,
      policyDefinitionsDir: 'control-plane/research-teams/policies',
      coordinationArtifactsRoot: path.join(tmpRoot, 'artifacts', 'research-teams')
    });

    const baselineEscalatedStatus = (engine as any).inspectTeam({ teamId: 'defi-risk-team' });
    expect(baselineEscalatedStatus.priority).toBe('critical');

    const first = engine.evaluateTeam({ teamId: 'defi-risk-team', slotReference: 'daily:2026-03-11' });
    expect(first.appendedEvents.map((entry) => entry.eventType)).toEqual([
      'investigation_routed',
      'response_priority_changed'
    ]);
    expect(first.routingDecision?.investigationTemplate).toBe('protocol-risk-investigation');

    phase = 'stabilizing';
    const second = engine.evaluateTeam({ teamId: 'defi-risk-team', slotReference: 'daily:2026-03-12' });
    const third = engine.evaluateTeam({ teamId: 'defi-risk-team', slotReference: 'daily:2026-03-13' });
    expect(second.appendedEvents.some((entry) => entry.eventType === 'response_stabilizing')).toBe(true);
    expect(second.projection.stabilizationState).toBe('stabilizing');
    expect(third.projection.stabilizationState).toBe('stabilizing');

    phase = 'resolved';
    const fourth = engine.evaluateTeam({ teamId: 'defi-risk-team', slotReference: 'daily:2026-03-14' });
    expect(fourth.projection.stabilizationState).toBe('resolved');
    expect(fourth.projection.readiness).toBe('resolved');
    expect(fourth.appendedEvents.some((entry) => entry.eventType === 'response_resolved')).toBe(true);

    const stableStatusAfterCoordination = (engine as any).inspectTeam({ teamId: 'defi-risk-team' });
    expect(stableStatusAfterCoordination.priority).toBe('normal');
    expect(stableStatusAfterCoordination.activeInvestigations).toEqual([]);
  });
});
