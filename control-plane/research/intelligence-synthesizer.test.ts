import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createArtifactAccumulator } from './artifact-accumulator.ts';
import { createIntelligenceSynthesizer, renderIntelligenceMarkdown } from './intelligence-synthesizer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-synth');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('intelligence synthesizer', () => {
  it('T-S1 renders deterministic markdown section ordering', () => {
    const markdown = renderIntelligenceMarkdown({
      reportDate: '2026-03-10',
      liquidityHighlights: [],
      yieldMovements: ['Aave: APY 5.2%, 24h +0.2%'],
      governanceEvents: [],
      riskSignals: [],
      watchlist: ['Aave']
    });

    expect(markdown).toContain('## Liquidity Highlights');
    expect(markdown).toContain('## Yield Movements');
    expect(markdown.indexOf('## Liquidity Highlights')).toBeLessThan(markdown.indexOf('## Yield Movements'));
    expect(markdown).toContain('- None');
  });

  it('T-S2 synthesizes datasets into deterministic summary artifacts', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts');
    writeJson(path.join(artifactsRoot, 'defi-intelligence', 'datasets', 'protocol_tvl_timeseries.json'), {
      datasetKey: 'protocol_tvl_timeseries',
      records: [{
        scheduleId: 'defi-liquidity-hourly-scan',
        slotId: 'interval_hours:6:2026-03-10T12:00Z',
        runId: 'run_1',
        sourceMission: 'defi-liquidity-scan',
        data: { protocol: 'Aave', tvl: '11.2B', delta24h: '+1.3%' }
      }]
    });
    writeJson(path.join(artifactsRoot, 'defi-intelligence', 'datasets', 'yield_rate_history.json'), {
      datasetKey: 'yield_rate_history',
      records: [{
        scheduleId: 'defi-yield-hourly-scan',
        slotId: 'interval_hours:6:2026-03-10T12:00Z',
        runId: 'run_2',
        sourceMission: 'defi-yield-report',
        data: { protocol: 'Aave', yield: '5.2%', change24h: '+0.2%' }
      }]
    });
    writeJson(path.join(artifactsRoot, 'defi-intelligence', 'datasets', 'governance_vote_tracker.json'), {
      datasetKey: 'governance_vote_tracker',
      records: [{
        scheduleId: 'defi-governance-hourly-scan',
        slotId: 'interval_hours:6:2026-03-10T12:00Z',
        runId: 'run_3',
        sourceMission: 'defi-governance-events',
        data: {
          protocol: 'Uniswap',
          proposal: 'Proposal 77',
          status: 'queued',
          riskSignal: 'Watch fee-switch governance split'
        }
      }]
    });

    const accumulator = createArtifactAccumulator({ artifactsRoot });
    const synthesizer = createIntelligenceSynthesizer({ artifactsRoot, accumulator });

    const output = synthesizer.synthesize({
      team: {
        teamId: 'defi-intelligence',
        missionPackId: 'defi-intelligence',
        description: 'team'
      },
      reportDate: '2026-03-10'
    });

    expect(output.summary.reportDate).toBe('2026-03-10');
    expect(output.summary.liquidityHighlights).toEqual(['Aave: TVL 11.2B, 24h +1.3%']);
    expect(fs.existsSync(output.artifacts.markdownPath)).toBe(true);
    expect(fs.existsSync(output.artifacts.jsonPath)).toBe(true);
  });
});
