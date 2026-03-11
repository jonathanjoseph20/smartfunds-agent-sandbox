import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTeamSwarmHistoryStore } from '../team-swarm-history-store.ts';
import { createTeamSwarmInspection } from '../team-swarm-inspection.ts';
import { createTeamSwarmProjection } from '../team-swarm-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-team-swarm-coordination');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team swarm coordination integration', () => {
  it('T-TS-I1 coordinates escalation -> activation -> lifecycle progression -> topic stabilization deterministically', () => {
    let phase: 'escalated' | 'progressing' | 'stabilizing' | 'completed' = 'escalated';

    const registry = {
      listByTeam: () => [{
        teamId: 'defi-risk-team',
        teamDisplayName: 'DeFi Risk Research Team',
        teamEnabled: true,
        swarmId: 'protocol-risk-response',
        swarmDisplayName: 'Protocol Risk Response Swarm',
        investigationTemplates: ['protocol-risk-investigation']
      }],
      listTeamsWithSwarms: () => [{
        teamId: 'defi-risk-team',
        teamDisplayName: 'DeFi Risk Research Team',
        teamEnabled: true,
        swarmCount: 1
      }]
    } as any;

    const teamInspection = {
      inspectStatus: () => ({
        teamId: 'defi-risk-team',
        activityState: phase === 'escalated' ? 'escalated_response' : 'monitoring',
        healthState: phase === 'escalated' ? 'conflicted' : 'healthy',
        linkedCohortIds: ['aave-risk'],
        linkedProgramIds: ['aave-risk-monitor'],
        linkedInvestigationIds: ['inv-1'],
        linkedSynthesisIds: ['syn-1'],
        responseReasons: []
      }),
      inspectCoordination: () => ({
        teamId: 'defi-risk-team',
        priority: phase === 'escalated' ? 'critical' : 'normal',
        readiness: phase === 'completed' ? 'resolved' : 'engaged',
        activeInvestigations: phase === 'completed' ? [] : ['inv-1'],
        stabilizationState: phase === 'completed' ? 'resolved' : 'stabilizing'
      })
    } as any;

    const swarmInspection = {
      inspectSwarm: () => ({
        swarmId: 'protocol-risk-response',
        teamId: 'defi-risk-team',
        investigations: [{
          investigationRunId: 'inv-1',
          investigationDefinitionId: 'protocol-risk-investigation',
          status: phase === 'completed' ? 'completed' : 'running'
        }],
        syntheses: [{
          synthesisId: 'syn-1',
          readinessState: phase === 'completed' ? 'ready' : 'active',
          unresolvedConflictCount: phase === 'stabilizing' ? 1 : 0
        }],
        state: phase === 'completed' ? 'completed' : 'progressing',
        readiness: {
          swarmId: 'protocol-risk-response',
          readiness: phase === 'completed' ? 'coherent' : phase === 'stabilizing' ? 'blocked' : 'analyzing',
          blockingReasons: [],
          strengths: [],
          limitations: [],
          expectedInvestigationCount: 1,
          linkedInvestigationCount: 1,
          synthesisReadyCount: phase === 'completed' ? 1 : 0,
          unresolvedConflictCount: phase === 'stabilizing' ? 1 : 0
        },
        completion: {
          swarmId: 'protocol-risk-response',
          isComplete: phase === 'completed',
          allInvestigationsComplete: phase === 'completed',
          conflictsResolved: phase !== 'stabilizing',
          completedInvestigationCount: phase === 'completed' ? 1 : 0,
          totalInvestigationCount: 1,
          unresolvedConflictCount: phase === 'stabilizing' ? 1 : 0,
          unmetRules: phase === 'completed' ? [] : ['requireAllInvestigationsComplete']
        },
        historySummary: {
          totalEvents: 0
        },
        statusPreview: {},
        reportPreview: {}
      })
    } as any;

    const cohortInspection = {
      inspectCohortEscalation: () => ({
        cohortId: 'aave-risk',
        escalationState: phase === 'escalated' ? 'escalated' : 'none'
      })
    } as any;

    const investigationInspection = {
      inspectCompletionStatus: () => ({
        investigationRunId: 'inv-1',
        readinessState: phase === 'completed' ? 'complete' : 'incomplete',
        convergenceState: phase === 'completed' ? 'converged' : 'inconclusive',
        healthState: 'healthy',
        blockingReasons: [],
        strengths: [],
        limitations: []
      })
    } as any;

    const historyStore = createTeamSwarmHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'team-swarms')
    });

    const projection = createTeamSwarmProjection({
      registry,
      teamInspection,
      swarmInspection,
      cohortInspection,
      investigationInspection,
      historyStore,
      teamSwarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'team-swarms')
    });

    const inspection = createTeamSwarmInspection({
      registry,
      projection,
      historyStore,
      teamSwarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'team-swarms')
    });

    const first = inspection.evaluateTeam({
      teamId: 'defi-risk-team',
      slotReference: 'daily:2026-03-11'
    });
    expect(first.projection.linkedSwarms[0]?.activation.activated).toBe(true);
    expect(first.projection.linkedSwarms[0]?.lifecycle).toBe('progressing');
    expect(first.projection.topicProgress.progress).toBe('active');

    phase = 'stabilizing';
    const second = inspection.evaluateTeam({
      teamId: 'defi-risk-team',
      slotReference: 'daily:2026-03-12'
    });
    expect(second.projection.linkedSwarms[0]?.lifecycle).toBe('stabilizing');
    expect(second.projection.topicProgress.progress).toBe('stabilizing');

    phase = 'completed';
    const third = inspection.evaluateTeam({
      teamId: 'defi-risk-team',
      slotReference: 'daily:2026-03-13'
    });
    expect(third.projection.linkedSwarms[0]?.completion.isComplete).toBe(true);
    expect(third.projection.topicProgress.progress).toBe('stabilized');

    const historyBefore = inspection.getTeamHistory('defi-risk-team');
    const repeat = inspection.evaluateTeam({
      teamId: 'defi-risk-team',
      slotReference: 'daily:2026-03-13'
    });
    const historyAfter = repeat.history;

    expect(historyAfter.entries.length).toBe(historyBefore.entries.length);
  });
});
