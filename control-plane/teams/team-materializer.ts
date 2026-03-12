import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { TeamMaterializationSummary, TeamProjection } from './team-definition-types.ts';
import {
  createTeamProjection,
  type TeamProjectionEngine,
} from './team-projection.ts';

const DEFAULT_TEAM_ARTIFACTS_ROOT = path.join('artifacts', 'teams');

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

function resolveTeamArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_TEAM_ARTIFACTS_ROOT);
}

function resolveTeamArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const teamId = normalizeRelativeSegment(input.teamId, 'team_id');
  return path.join(resolveTeamArtifactsRoot(input.rootDir), teamId);
}

function resolveTeamArtifactPaths(input: { teamId: string; rootDir?: string }) {
  const dirPath = resolveTeamArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'team-status.json'),
    historyJsonPath: path.join(dirPath, 'team-history.json'),
    reportJsonPath: path.join(dirPath, 'team-report.json'),
    reportMarkdownPath: path.join(dirPath, 'team-report.md'),
  };
}

function toMarkdownReport(projection: TeamProjection): string {
  const lines = [
    '# Team Registry Report',
    '',
    `Team: ${projection.definition.displayName} (${projection.teamId})`,
    `Type: ${projection.definition.teamType}`,
    '',
    '## Purpose',
    projection.definition.purpose,
    '',
    '## Tags and Capability Profile',
    `- domainTags: ${projection.definition.domainTags.join(', ') || 'none'}`,
    `- capabilityTags: ${projection.definition.capabilityTags.join(', ') || 'none'}`,
    '',
    '## Supported Mappings',
    `- supportedMissionTypes: ${projection.definition.supportedMissionTypes.join(', ') || 'none'}`,
    `- supportedTemplateIds: ${projection.definition.supportedTemplateIds.join(', ') || 'none'}`,
    '',
    '## State Summary',
    `- lifecycleState: ${projection.status.lifecycleState}`,
    `- availabilityState: ${projection.status.availabilityState}`,
    `- readinessState: ${projection.status.readinessState}`,
    '',
    '## Blocking and Limitations',
    `- blockingReasons: ${projection.status.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${projection.status.limitations.join(', ') || 'none'}`,
    '',
    '## Roster Policy',
    `- type: ${projection.definition.rosterPolicy.type}`,
    `- minAgents: ${String(projection.definition.rosterPolicy.minAgents)}`,
    `- maxAgents: ${String(projection.definition.rosterPolicy.maxAgents)}`,
    `- requiredCapabilities: ${projection.definition.rosterPolicy.requiredCapabilities.join(', ') || 'none'}`,
    '',
    '## Notes',
    ...projection.definition.notes.map((note) => `- ${note}`),
    '',
    '## History Summary',
    `- totalEvents: ${String(projection.history.entries.length)}`,
    `- eventTypes: ${projection.history.entries.map((entry) => entry.eventType).join(', ') || 'none'}`,
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createTeamMaterializer(options: {
  projection?: TeamProjectionEngine;
  definitionsDir?: string;
  artifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createTeamProjection({ definitionsDir: options.definitionsDir });

  function materializeProjection(input: { projection: TeamProjection }): TeamMaterializationSummary {
    const paths = resolveTeamArtifactPaths({
      teamId: input.projection.teamId,
      rootDir: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.status)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(input.projection.history)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection), 'utf8');

    return {
      teamId: input.projection.teamId,
      statusPath: paths.statusJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
    };
  }

  function materializeOne(teamId: string): TeamMaterializationSummary {
    return materializeProjection({ projection: projection.projectOne(teamId) });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type TeamMaterializer = ReturnType<typeof createTeamMaterializer>;
