import fs from 'node:fs';
import path from 'node:path';

import { resolveArtifactDirectory } from './artifact-manager.ts';

function listFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function listArtifactsForRun(input: {
  missionId: string;
  runId: string;
  artifactsRoot?: string;
}): string[] {
  const runDirectory = resolveArtifactDirectory(input.missionId, input.runId);

  if (input.artifactsRoot) {
    const relative = path.join(input.missionId, input.runId);
    return listFiles(path.join(input.artifactsRoot, relative));
  }

  return listFiles(runDirectory);
}
