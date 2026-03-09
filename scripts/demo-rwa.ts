import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { listFilesInDirectory, readFilePreview, resolveUniqueRunDirectory } from './artifacts-utils.ts';

type RunCommandResult = {
  stdout: string;
};

type DemoDeps = {
  runCommand?: (command: string, args: string[]) => RunCommandResult;
};

function runCommandDefault(command: string, args: string[]): RunCommandResult {
  const stdout = String(execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe' }));
  return { stdout };
}

function tryParseJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const candidates = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'));

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    candidates.unshift(trimmed);
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Continue scanning candidates; npm script wrappers can prepend non-JSON lines.
    }
  }

  return null;
}

function extractRunId(raw: string): string {
  const parsed = tryParseJson<Record<string, unknown>>(raw.trim());

  if (parsed && typeof parsed === 'object') {
    const candidates = [parsed.workflowRun, parsed.runId, parsed.workflowRunId];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
  }

  const regexMatch = raw.match(/\b(run_[A-Za-z0-9_-]+)\b/);
  if (regexMatch && regexMatch[1]) {
    return regexMatch[1];
  }

  throw new Error('RUN_ID_NOT_FOUND');
}

function summarizeWorkflow(raw: string): { status: string; nodes: string[] } {
  const parsed = tryParseJson<Record<string, unknown>>(raw.trim());
  if (!parsed) {
    return { status: 'unknown', nodes: [] };
  }

  const workflow = parsed.workflow;
  let status = 'unknown';
  if (workflow && typeof workflow === 'object' && typeof (workflow as { status?: unknown }).status === 'string') {
    status = (workflow as { status: string }).status;
  }

  const nodesValue = parsed.nodes;
  const nodes = Array.isArray(nodesValue)
    ? nodesValue
      .filter((entry) => entry && typeof entry === 'object' && typeof (entry as { nodeId?: unknown }).nodeId === 'string')
      .map((entry) => (entry as { nodeId: string }).nodeId)
      .sort((left, right) => left.localeCompare(right))
    : [];

  return { status, nodes };
}

function summarizeArtifacts(raw: string, runDir: string): string[] {
  const parsed = tryParseJson<Record<string, unknown>>(raw.trim());
  if (parsed) {
    const artifactsValue = parsed.artifacts;
    if (Array.isArray(artifactsValue)) {
      return artifactsValue
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry as string)
        .sort((left, right) => left.localeCompare(right));
    }
  }

  const lines = raw.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('Artifacts for '));

  if (lines.length > 0) {
    return [...lines].sort((left, right) => left.localeCompare(right));
  }

  return listFilesInDirectory(runDir);
}

export async function main(argv: string[] = process.argv.slice(2), deps: DemoDeps = {}): Promise<number> {
  try {
    if (argv.length > 0) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
    }

    const runCommand = deps.runCommand ?? runCommandDefault;
    const missionId = 'rwa-market-analysis';

    process.stdout.write('SMARTFUNDS DEMO START\n\n');
    process.stdout.write(`Launching mission: ${missionId}\n\n`);

    const missionResult = runCommand('npm', ['run', 'mission:run', '--', '--mission', missionId]);
    const runId = extractRunId(missionResult.stdout);

    process.stdout.write('Mission completed\n');
    process.stdout.write(`Run ID: ${runId}\n\n`);

    const workflowResult = runCommand('npm', ['run', 'workflow:run-inspect', '--', '--run', runId]);
    const workflowSummary = summarizeWorkflow(workflowResult.stdout);

    process.stdout.write(`Workflow Status: ${workflowSummary.status}\n\n`);
    process.stdout.write('Nodes:\n');
    if (workflowSummary.nodes.length === 0) {
      process.stdout.write('none\n');
    } else {
      for (const nodeId of workflowSummary.nodes) {
        process.stdout.write(`${nodeId}\n`);
      }
    }

    process.stdout.write('\n');

    const artifactsResult = runCommand('npm', ['run', 'artifacts:list', '--', '--run', runId]);
    const resolved = resolveUniqueRunDirectory(path.join('.', 'artifacts'), runId);
    const artifacts = summarizeArtifacts(artifactsResult.stdout, resolved.directory);

    process.stdout.write('Artifacts:\n');
    if (artifacts.length === 0) {
      process.stdout.write('none\n');
    } else {
      for (const artifact of artifacts) {
        process.stdout.write(`${artifact}\n`);
      }
    }

    const report = readFilePreview(path.join(resolved.directory, 'report.md'), 80);
    const dataset = readFilePreview(path.join(resolved.directory, 'dataset.csv'), 20);

    process.stdout.write('\n--- REPORT PREVIEW ---\n\n');
    if (report.exists) {
      process.stdout.write(`${report.content}\n`);
    } else {
      process.stdout.write('report.md not found for this run.\n');
    }

    process.stdout.write('\n--- DATASET PREVIEW ---\n\n');
    if (dataset.exists) {
      process.stdout.write(`${dataset.content}\n`);
    } else {
      process.stdout.write('dataset.csv not found for this run.\n');
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_runtime_error';
    process.stdout.write(`DEMO_FAILED: ${message}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write('DEMO_FAILED: unexpected_runtime_error\n');
    process.exit(2);
  });
}
