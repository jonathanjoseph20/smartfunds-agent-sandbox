import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { InvestigationInspection } from '../../investigations/investigation-inspection.ts';
import type { SynthesisInspection } from '../../synthesis/synthesis-inspection.ts';
import { createSwarmHistoryStore } from '../swarm-history-store.ts';
import { createSwarmInspection } from '../swarm-inspection.ts';
import { createSwarmProjection } from '../swarm-projection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-swarm-lifecycle');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('swarm lifecycle integration', () => {
  it('T-SW-I1 coordinates activation, progression, and completion deterministically', () => {
    const investigations: Array<{ investigationRunId: string; investigationDefinitionId: string; status: string }> = [];
    const syntheses: Array<{ synthesisId: string; linkedInvestigationIds: string[]; readinessState: string; unresolvedConflictCount: number }> = [];

    const investigationInspection = {
      listInvestigations: () => [...investigations].sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId))
    } as unknown as InvestigationInspection;

    const synthesisInspection = {
      listSynthesisSets: () => [...syntheses]
        .sort((left, right) => left.synthesisId.localeCompare(right.synthesisId))
        .map((entry) => ({
          synthesisId: entry.synthesisId,
          synthesisType: 'protocol-risk-synthesis',
          subjectKey: 'protocol:aave',
          status: entry.readinessState,
          linkedInvestigationCount: entry.linkedInvestigationIds.length,
          confidenceBand: 'medium',
          artifactPaths: []
        })),
      inspectLinks: (synthesisId: string) => {
        const found = syntheses.find((entry) => entry.synthesisId === synthesisId);
        return {
          synthesisId,
          synthesisType: 'protocol-risk-synthesis',
          subjectKey: 'protocol:aave',
          linkedInvestigationIds: [...(found?.linkedInvestigationIds ?? [])].sort((left, right) => left.localeCompare(right)),
          linkedReasons: []
        };
      },
      inspectStatus: (synthesisId: string) => {
        const found = syntheses.find((entry) => entry.synthesisId === synthesisId);
        return {
          synthesisId,
          readinessState: found?.readinessState ?? 'pending',
          blockingReasons: [],
          linkedInvestigationCount: found?.linkedInvestigationIds.length ?? 0,
          completedInvestigationCount: 0,
          unresolvedConflictCount: found?.unresolvedConflictCount ?? 0,
          strengths: [],
          limitations: []
        };
      },
      inspectConflicts: (synthesisId: string) => {
        const found = syntheses.find((entry) => entry.synthesisId === synthesisId);
        return {
          synthesisId,
          conflicts: Array.from({ length: found?.unresolvedConflictCount ?? 0 }).map((_, index) => ({
            conflictId: `${synthesisId}:conflict:${String(index + 1)}`,
            type: 'direct_finding_conflict',
            severity: 'high',
            summary: 'deterministic-conflict',
            investigationIds: [],
            findingIds: []
          }))
        };
      }
    } as unknown as SynthesisInspection;

    const historyStore = createSwarmHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'research-swarms')
    });

    const projection = createSwarmProjection({
      investigationInspection,
      synthesisInspection,
      historyStore,
      swarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'research-swarms')
    });

    const inspection = createSwarmInspection({
      projection,
      historyStore,
      swarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'research-swarms')
    });

    const initial = inspection.inspectSwarm('protocol-risk-response');
    expect(initial.state).toBe('inactive');

    investigations.push(
      { investigationRunId: 'run-1', investigationDefinitionId: 'protocol-risk-investigation', status: 'running' },
      { investigationRunId: 'run-2', investigationDefinitionId: 'liquidity-drain-investigation', status: 'running' },
      { investigationRunId: 'run-3', investigationDefinitionId: 'governance-proposal-investigation', status: 'running' }
    );

    const active = inspection.evaluateSwarm({
      swarmId: 'protocol-risk-response',
      slotReference: 'daily:2026-03-11'
    });
    expect(active.projection.state).toBe('active');

    syntheses.push({
      synthesisId: 'syn-1',
      linkedInvestigationIds: ['run-1', 'run-2', 'run-3'],
      readinessState: 'active',
      unresolvedConflictCount: 1
    });

    const stabilizing = inspection.evaluateSwarm({
      swarmId: 'protocol-risk-response',
      slotReference: 'daily:2026-03-12'
    });
    expect(stabilizing.projection.state).toBe('stabilizing');
    expect(stabilizing.projection.readiness.readiness).toBe('blocked');

    investigations.splice(0, investigations.length,
      { investigationRunId: 'run-1', investigationDefinitionId: 'protocol-risk-investigation', status: 'completed' },
      { investigationRunId: 'run-2', investigationDefinitionId: 'liquidity-drain-investigation', status: 'completed' },
      { investigationRunId: 'run-3', investigationDefinitionId: 'governance-proposal-investigation', status: 'completed' }
    );
    syntheses.splice(0, syntheses.length, {
      synthesisId: 'syn-1',
      linkedInvestigationIds: ['run-1', 'run-2', 'run-3'],
      readinessState: 'ready',
      unresolvedConflictCount: 0
    });

    const completed = inspection.evaluateSwarm({
      swarmId: 'protocol-risk-response',
      slotReference: 'daily:2026-03-13'
    });
    expect(completed.projection.state).toBe('completed');
    expect(completed.projection.completion.isComplete).toBe(true);
    expect(completed.projection.readiness.readiness).toBe('coherent');

    const history = inspection.getSwarmHistory('protocol-risk-response');
    expect(history.entries.length).toBeGreaterThan(0);

    const firstHistoryFile = path.join(tmpRoot, 'snapshot-history-1.json');
    const secondHistoryFile = path.join(tmpRoot, 'snapshot-history-2.json');
    fs.writeFileSync(firstHistoryFile, JSON.stringify(history, null, 2), 'utf8');

    const repeated = inspection.evaluateSwarm({
      swarmId: 'protocol-risk-response',
      slotReference: 'daily:2026-03-13'
    });

    fs.writeFileSync(secondHistoryFile, JSON.stringify(repeated.history, null, 2), 'utf8');
    expect(fs.readFileSync(firstHistoryFile, 'utf8')).toBe(fs.readFileSync(secondHistoryFile, 'utf8'));
  });
});
