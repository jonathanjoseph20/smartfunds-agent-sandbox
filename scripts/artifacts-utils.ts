import fs from 'node:fs';
import path from 'node:path';

export type ResolvedRunDirectory = {
  missionId: string;
  runId: string;
  directory: string;
};

export type RunArtifactMetadata = {
  profile?: string;
  executionPath?: string;
  status?: string;
  artifactCount?: number;
  branchName?: string;
  prNumber?: number;
  prUrl?: string;
  mutationSummary?: string[];
};

export function findRunDirectoriesByRunId(artifactsRoot: string, runId: string): ResolvedRunDirectory[] {
  if (!fs.existsSync(artifactsRoot)) {
    return [];
  }

  const missions = fs.readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const matches: ResolvedRunDirectory[] = [];

  for (const missionId of missions) {
    const missionDir = path.join(artifactsRoot, missionId);
    const runDir = path.join(missionDir, runId);
    if (fs.existsSync(runDir) && fs.statSync(runDir).isDirectory()) {
      matches.push({
        missionId,
        runId,
        directory: runDir
      });
    }
  }

  return matches.sort((left, right) => left.directory.localeCompare(right.directory));
}

export function resolveUniqueRunDirectory(artifactsRoot: string, runId: string): ResolvedRunDirectory {
  const matches = findRunDirectoriesByRunId(artifactsRoot, runId);

  if (matches.length === 0) {
    throw new Error(`ARTIFACT_RUN_NOT_FOUND: ${runId}`);
  }

  if (matches.length > 1) {
    const locations = matches.map((match) => path.join(match.missionId, match.runId)).join(', ');
    throw new Error(`ARTIFACT_RUN_AMBIGUOUS: ${runId}: ${locations}`);
  }

  return matches[0] as ResolvedRunDirectory;
}

export function listFilesInDirectory(directory: string): string[] {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function readFilePreview(filePath: string, maxLines: number): { exists: boolean; content: string } {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return {
      exists: false,
      content: ''
    };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const preview = lines.slice(0, maxLines).join('\n').trimEnd();

  return {
    exists: true,
    content: preview
  };
}

export function readRunMetadata(directory: string): RunArtifactMetadata {
  const metadataPath = path.join(directory, 'run-metadata.json');
  if (!fs.existsSync(metadataPath) || !fs.statSync(metadataPath).isFile()) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as Record<string, unknown>;
    return {
      ...(typeof parsed.profile === 'string' ? { profile: parsed.profile } : {}),
      ...(typeof parsed.executionPath === 'string' ? { executionPath: parsed.executionPath } : {}),
      ...(typeof parsed.status === 'string' ? { status: parsed.status } : {}),
      ...(typeof parsed.artifactCount === 'number' ? { artifactCount: parsed.artifactCount } : {}),
      ...(typeof parsed.branchName === 'string' ? { branchName: parsed.branchName } : {}),
      ...(typeof parsed.prNumber === 'number' ? { prNumber: parsed.prNumber } : {}),
      ...(typeof parsed.prUrl === 'string' ? { prUrl: parsed.prUrl } : {}),
      ...(Array.isArray(parsed.mutationSummary)
        ? {
          mutationSummary: parsed.mutationSummary
            .filter((entry): entry is string => typeof entry === 'string')
            .sort((left, right) => left.localeCompare(right))
        }
        : {})
    };
  } catch {
    return {};
  }
}

export function collectRunsFromArtifacts(artifactsRoot: string): Array<{
  missionId: string;
  runId: string;
  metadata: RunArtifactMetadata;
}> {
  if (!fs.existsSync(artifactsRoot) || !fs.statSync(artifactsRoot).isDirectory()) {
    return [];
  }

  const missions = fs.readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const runs: Array<{ missionId: string; runId: string; metadata: RunArtifactMetadata }> = [];

  for (const missionId of missions) {
    const missionDir = path.join(artifactsRoot, missionId);
    const missionEntries = fs.readdirSync(missionDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const runId of missionEntries) {
      if (!runId.startsWith('run_')) {
        continue;
      }

      const runDir = path.join(missionDir, runId);
      runs.push({
        missionId,
        runId,
        metadata: readRunMetadata(runDir)
      });
    }
  }

  return runs.sort((left, right) => {
    const byMission = left.missionId.localeCompare(right.missionId);
    if (byMission !== 0) {
      return byMission;
    }
    return left.runId.localeCompare(right.runId);
  });
}
