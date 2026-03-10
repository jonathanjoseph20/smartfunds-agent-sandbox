import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import { createArtifactAccumulator, type ArtifactAccumulator } from './artifact-accumulator.ts';
import type { IntelligenceSummary, ResearchTeam, TeamSummaryArtifacts } from './types.ts';

const DEFAULT_ARTIFACTS_ROOT = 'artifacts';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function readReportDateFromSlot(slotId: string): string {
  const dailyPrefix = 'daily:';
  if (slotId.startsWith(dailyPrefix)) {
    return slotId.slice(dailyPrefix.length);
  }

  const intervalMatch = slotId.match(/(\d{4}-\d{2}-\d{2})/);
  if (intervalMatch?.[1]) {
    return intervalMatch[1];
  }

  return 'unknown-date';
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDatasetRecords(input: {
  accumulator: ArtifactAccumulator;
  teamId: string;
  datasetKey: string;
}): Array<Record<string, unknown>> {
  const dataset = input.accumulator.readDataset({
    teamId: input.teamId,
    datasetKey: input.datasetKey
  });

  return dataset.records
    .map((entry) => entry.data)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as Record<string, unknown>);
}

function buildSummary(input: {
  reportDate: string;
  liquidityRows: Array<Record<string, unknown>>;
  yieldRows: Array<Record<string, unknown>>;
  governanceRows: Array<Record<string, unknown>>;
}): IntelligenceSummary {
  const liquidityHighlights = sortedUnique(input.liquidityRows.map((row) => {
    const protocol = asString(row.protocol) ?? 'Unknown protocol';
    const tvl = asString(row.tvl) ?? 'n/a';
    const delta = asString(row.delta24h) ?? asString(row.delta) ?? 'n/a';
    return `${protocol}: TVL ${tvl}, 24h ${delta}`;
  }));

  const yieldMovements = sortedUnique(input.yieldRows.map((row) => {
    const protocol = asString(row.protocol) ?? 'Unknown protocol';
    const apy = asString(row.apy) ?? asString(row.yield) ?? 'n/a';
    const change = asString(row.change24h) ?? 'n/a';
    return `${protocol}: APY ${apy}, 24h ${change}`;
  }));

  const governanceEvents = sortedUnique(input.governanceRows.map((row) => {
    const protocol = asString(row.protocol) ?? 'Unknown protocol';
    const proposal = asString(row.proposal) ?? 'unspecified proposal';
    const status = asString(row.status) ?? 'status unknown';
    return `${protocol}: ${proposal} (${status})`;
  }));

  const riskSignals = sortedUnique(input.governanceRows
    .map((row) => asString(row.riskSignal))
    .filter((entry): entry is string => entry !== null));

  const watchlist = sortedUnique([
    ...input.liquidityRows
      .map((row) => asString(row.protocol))
      .filter((entry): entry is string => entry !== null),
    ...input.yieldRows
      .map((row) => asString(row.protocol))
      .filter((entry): entry is string => entry !== null)
  ]);

  return {
    reportDate: input.reportDate,
    liquidityHighlights,
    yieldMovements,
    governanceEvents,
    riskSignals,
    watchlist
  };
}

function renderSection(title: string, items: string[]): string {
  const rows = items.length > 0 ? items.map((entry) => `- ${entry}`) : ['- None'];
  return [
    `## ${title}`,
    ...rows,
    ''
  ].join('\n');
}

export function renderIntelligenceMarkdown(summary: IntelligenceSummary): string {
  return [
    '# DeFi Daily Intelligence',
    '',
    `Report Date: ${summary.reportDate}`,
    '',
    renderSection('Liquidity Highlights', summary.liquidityHighlights),
    renderSection('Yield Movements', summary.yieldMovements),
    renderSection('Governance Events', summary.governanceEvents),
    renderSection('Risk Signals', summary.riskSignals),
    renderSection('Watchlist / Follow-ups', summary.watchlist)
  ].join('\n');
}

export function createIntelligenceSynthesizer(input: {
  artifactsRoot?: string;
  accumulator?: ArtifactAccumulator;
} = {}) {
  const artifactsRoot = input.artifactsRoot ?? DEFAULT_ARTIFACTS_ROOT;
  const accumulator = input.accumulator ?? createArtifactAccumulator({ artifactsRoot });

  function synthesize(inputArgs: {
    team: ResearchTeam;
    reportDate: string;
  }): {
    summary: IntelligenceSummary;
    artifacts: TeamSummaryArtifacts;
  } {
    const teamDir = path.join(artifactsRoot, inputArgs.team.teamId);
    const summariesDir = path.join(teamDir, 'daily-briefs');
    ensureDir(summariesDir);

    const summary = buildSummary({
      reportDate: inputArgs.reportDate,
      liquidityRows: readDatasetRecords({ accumulator, teamId: inputArgs.team.teamId, datasetKey: 'protocol_tvl_timeseries' }),
      yieldRows: readDatasetRecords({ accumulator, teamId: inputArgs.team.teamId, datasetKey: 'yield_rate_history' }),
      governanceRows: readDatasetRecords({ accumulator, teamId: inputArgs.team.teamId, datasetKey: 'governance_vote_tracker' })
    });

    const jsonPath = path.join(summariesDir, `defi-daily-intelligence-${summary.reportDate}.json`);
    const markdownPath = path.join(summariesDir, `defi-daily-intelligence-${summary.reportDate}.md`);
    fs.writeFileSync(jsonPath, `${canonicalStringify(summary)}\n`, 'utf8');
    fs.writeFileSync(markdownPath, `${renderIntelligenceMarkdown(summary)}\n`, 'utf8');

    const latestPath = path.join(summariesDir, 'latest-summary.json');
    fs.writeFileSync(latestPath, `${canonicalStringify({ reportDate: summary.reportDate, jsonPath, markdownPath })}\n`, 'utf8');

    return {
      summary,
      artifacts: {
        jsonPath,
        markdownPath
      }
    };
  }

  return {
    synthesize,
    reportDateFromSlot: readReportDateFromSlot
  };
}

export type IntelligenceSynthesizer = ReturnType<typeof createIntelligenceSynthesizer>;
