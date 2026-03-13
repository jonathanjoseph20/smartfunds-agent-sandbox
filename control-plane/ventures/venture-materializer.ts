import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { VentureMaterializationSummary, VentureProjection } from './venture-types.ts';
import {
  createVentureProjection,
  type VentureProjectionEngine,
} from './venture-projection.ts';

const DEFAULT_VENTURE_ARTIFACTS_ROOT = path.join('artifacts', 'ventures');

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}`);
  }
  return normalized;
}

function resolveVentureArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_VENTURE_ARTIFACTS_ROOT);
}

function resolveVentureArtifactDir(input: { ventureId: string; rootDir?: string }): string {
  const ventureId = normalizeRelativeSegment(input.ventureId, 'venture_id');
  return path.join(resolveVentureArtifactsRoot(input.rootDir), ventureId);
}

function resolveVentureArtifactPaths(input: { ventureId: string; rootDir?: string }) {
  const dirPath = resolveVentureArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'venture-status.json'),
    reportJsonPath: path.join(dirPath, 'venture-report.json'),
    reportMarkdownPath: path.join(dirPath, 'venture-report.md'),
    historyJsonPath: path.join(dirPath, 'venture-history.json'),
    linksJsonPath: path.join(dirPath, 'venture-links.json'),
    summaryJsonPath: path.join(dirPath, 'venture-summary.json'),
  };
}

function toMarkdownReport(projection: VentureProjection): string {
  const lines = [
    '# Venture Registry Report',
    '',
    `Venture: ${projection.ventureName} (${projection.ventureId})`,
    `Class: ${projection.ventureClass}`,
    `Lifecycle: ${projection.ventureLifecycleState}`,
    `Status: ${projection.ventureStatus}`,
    '',
    '## Ownership and Operating Mode',
    `- ownershipModel: ${projection.ownershipModel}`,
    `- operatingMode: ${projection.operatingMode}`,
    '',
    '## Origin and Links',
    `- originMissionIds: ${projection.originSummary.originMissionIds.join(', ') || 'none'}`,
    `- linkedMissionPortfolioIds: ${projection.originSummary.linkedMissionPortfolioIds.join(', ') || 'none'}`,
    `- linkedEntityIds: ${projection.originSummary.linkedEntityIds.join(', ') || 'none'}`,
    `- linkedTeamIds: ${projection.linkedTeamIds.join(', ') || 'none'}`,
    '',
    '## Tags',
    `- domainTags: ${projection.definition.domainTags.join(', ') || 'none'}`,
    `- productTypeTags: ${projection.definition.productTypeTags.join(', ') || 'none'}`,
    `- jurisdictionTags: ${projection.definition.jurisdictionTags.join(', ') || 'none'}`,
    '',
    '## Constraints',
    `- blockingReasons: ${projection.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${projection.limitations.join(', ') || 'none'}`,
    '',
    '## Determinism',
    `- historyDigest: ${projection.historyDigest}`,
    `- eventCount: ${String(projection.history.entries.length)}`,
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createVentureMaterializer(options: {
  projection?: VentureProjectionEngine;
  definitionsDir?: string;
  artifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createVentureProjection({ definitionsDir: options.definitionsDir });

  function materializeProjection(input: { projection: VentureProjection }): VentureMaterializationSummary {
    const paths = resolveVentureArtifactPaths({
      ventureId: input.projection.ventureId,
      rootDir: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    const links = {
      ventureId: input.projection.ventureId,
      originMissionIds: input.projection.originSummary.originMissionIds,
      linkedMissionPortfolioIds: input.projection.originSummary.linkedMissionPortfolioIds,
      linkedTeamIds: input.projection.linkedTeamIds,
      linkedEntityIds: input.projection.originSummary.linkedEntityIds,
    };

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.summary)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(input.projection.history)}\n`, 'utf8');
    fs.writeFileSync(paths.linksJsonPath, `${canonicalStringify(links)}\n`, 'utf8');
    fs.writeFileSync(paths.summaryJsonPath, `${canonicalStringify(input.projection.summary)}\n`, 'utf8');

    return {
      ventureId: input.projection.ventureId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      linksPath: paths.linksJsonPath,
      summaryPath: paths.summaryJsonPath,
    };
  }

  function materializeOne(ventureId: string): VentureMaterializationSummary {
    return materializeProjection({ projection: projection.projectOne(ventureId) });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type VentureMaterializer = ReturnType<typeof createVentureMaterializer>;
