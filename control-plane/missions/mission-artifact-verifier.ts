import fs from 'node:fs';
import path from 'node:path';

import type { MissionTemplateDefinition } from './mission-control-types.ts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((entry) => fs.statSync(path.join(dir, entry)).isFile())
    .sort((left, right) => left.localeCompare(right));
}

export function verifyMissionArtifacts(input: {
  template: MissionTemplateDefinition;
  artifactsDir: string;
}): {
  valid: boolean;
  missing: string[];
  unexpected: string[];
} {
  const expected = sortedUnique(input.template.artifacts.map((artifact) => artifact.name));
  const actual = listFiles(input.artifactsDir);

  const missing = expected.filter((name) => !actual.includes(name));
  const unexpected = actual.filter((name) => !expected.includes(name));

  return {
    valid: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected
  };
}

export function assertMissionArtifacts(input: {
  template: MissionTemplateDefinition;
  artifactsDir: string;
}): void {
  const result = verifyMissionArtifacts(input);
  if (!result.valid) {
    const details = [
      result.missing.length > 0 ? `missing=${result.missing.join(',')}` : '',
      result.unexpected.length > 0 ? `unexpected=${result.unexpected.join(',')}` : ''
    ].filter((entry) => entry.length > 0).join(';');

    throw new Error(`MISSION_ARTIFACTS_INVALID: ${input.template.missionId}: ${details}`);
  }
}
