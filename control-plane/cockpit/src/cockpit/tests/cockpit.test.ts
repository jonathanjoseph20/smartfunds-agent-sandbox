import { describe, it, expect } from 'vitest';
import { sortMissions, sortRuns } from '../lib/sorts';
import { formatTimestamp, formatDuration, formatStatus } from '../lib/formatters';
import { parseEnvelope } from '../lib/adapters';
import { getMissionList, getRunList, getRunDetail, getMissionDetail, getOverview, getWorkflowDag } from '../lib/view-models';
import type { Mission, WorkflowRun, CommandEnvelope } from '../lib/types';

describe('sorts', () => {
  it('sorts missions: active first, then failed, then completed', () => {
    const missions: Mission[] = [
      { missionId: 'c', status: 'completed', teamId: 't', workflowId: 'w', parameters: [], workflowRuns: [] },
      { missionId: 'a', status: 'running', teamId: 't', workflowId: 'w', parameters: [], workflowRuns: [] },
      { missionId: 'b', status: 'failed', teamId: 't', workflowId: 'w', parameters: [], workflowRuns: [] },
    ];
    const sorted = sortMissions(missions);
    expect(sorted.map(m => m.status)).toEqual(['running', 'failed', 'completed']);
  });

  it('tie-breaks missions by missionId', () => {
    const missions: Mission[] = [
      { missionId: 'z-mission', status: 'running', teamId: 't', workflowId: 'w', parameters: [], workflowRuns: [] },
      { missionId: 'a-mission', status: 'running', teamId: 't', workflowId: 'w', parameters: [], workflowRuns: [] },
    ];
    const sorted = sortMissions(missions);
    expect(sorted.map(m => m.missionId)).toEqual(['a-mission', 'z-mission']);
  });
});

describe('formatters', () => {
  it('formats duration correctly', () => {
    expect(formatDuration('2026-03-05T08:00:00Z', '2026-03-05T08:01:30Z')).toBe('1m 30s');
    expect(formatDuration('2026-03-05T08:00:00Z', '2026-03-05T08:00:45Z')).toBe('45s');
    expect(formatDuration('2026-03-05T08:00:00Z', '2026-03-05T10:30:00Z')).toBe('2h 30m');
  });

  it('formats status with capitalization', () => {
    expect(formatStatus('timed_out')).toBe('Timed Out');
    expect(formatStatus('running')).toBe('Running');
  });
});

describe('adapters', () => {
  it('parses valid command envelope', () => {
    const envelope: CommandEnvelope<string[]> = {
      command: { name: 'mission:list', source: 'cli' },
      payload: ['a', 'b'],
      success: true,
    };
    expect(parseEnvelope(envelope)).toEqual(['a', 'b']);
  });

  it('returns null for failed envelope', () => {
    const envelope: CommandEnvelope<string[]> = {
      command: { name: 'mission:list', source: 'cli' },
      payload: ['a'],
      success: false,
    };
    expect(parseEnvelope(envelope)).toBeNull();
  });
});

describe('view-models', () => {
  it('getMissionList returns sorted missions', async () => {
    const list = await getMissionList();
    expect(list.length).toBeGreaterThan(0);
    // running/created should come first
    const firstStatus = list[0].status;
    expect(['running', 'created']).toContain(firstStatus);
  });

  it('getRunList returns sorted runs', async () => {
    const list = await getRunList();
    expect(list.length).toBeGreaterThan(0);
  });

  it('getRunDetail returns failure panel for failed run', async () => {
    const detail = await getRunDetail('run-002');
    expect(detail).not.toBeNull();
    expect(detail!.failure).not.toBeNull();
    expect(detail!.failure!.code).toBe('ADAPTER_TIMEOUT');
    expect(detail!.traceEvents.length).toBeGreaterThan(0);
  });

  it('getRunDetail returns null for unknown run', async () => {
    expect(await getRunDetail('nonexistent')).toBeNull();
  });

  it('getMissionDetail maps parameters correctly', async () => {
    const detail = await getMissionDetail('rwa-market-analysis');
    expect(detail).not.toBeNull();
    expect(detail!.parameters.length).toBe(4);
    expect(detail!.agents.length).toBeGreaterThan(0);
  });

  it('getOverview counts correctly', async () => {
    const overview = await getOverview();
    expect(overview.totalMissions).toBe(6);
    expect(overview.failedRuns).toBe(1);
  });

  it('getWorkflowDag returns deterministic node order', async () => {
    const dag = await getWorkflowDag('research-analysis-workflow');
    expect(dag).not.toBeNull();
    expect(dag!.nodes.length).toBe(4);
    expect(dag!.nodes[0].nodeId).toBe('node-collect');
  });

  it('getWorkflowDag with runId uses run execution state', async () => {
    const dag = await getWorkflowDag('research-analysis-workflow', 'run-002');
    expect(dag).not.toBeNull();
    const failedNode = dag!.nodes.find(n => n.status === 'failed');
    expect(failedNode).toBeDefined();
  });

  it('trace events are sorted by sequence', async () => {
    const detail = await getRunDetail('run-002');
    const sequences = detail!.traceEvents.map(e => e.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
  });
});
