import fs from 'node:fs';
import path from 'node:path';

type WorkflowRunStep = {
  stepName: string;
  run: string;
};

type WorkflowParseResult = {
  runs: WorkflowRunStep[];
};

type VerificationFailure = {
  type: 'parse' | 'missing' | 'disallowed';
  workflowFile: string;
  stepName: string;
  message: string;
  entrypoint?: string;
};

type VerifyOptions = {
  repoRoot?: string;
  allowlist?: string[];
};

const DEFAULT_ALLOWLIST = [
  'control-plane/validate-pr.ts'
] as const;

function countLeadingSpaces(line: string): number {
  let spaces = 0;
  while (spaces < line.length && line[spaces] === ' ') {
    spaces += 1;
  }
  return spaces;
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf('#');
  if (hashIndex === -1) {
    return line;
  }
  return line.slice(0, hashIndex);
}

function parseKeyValue(trimmed: string): { key: string; value: string } | null {
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) {
    return null;
  }
  const key = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 1).trim();
  if (!key) {
    return null;
  }
  return { key, value };
}

function parseWorkflowRuns(content: string, workflowFile: string): WorkflowParseResult {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const runs: WorkflowRunStep[] = [];

  let inJobs = false;
  let inSteps = false;
  let currentStepName = '(unnamed step)';
  let currentStepIndex = 0;

  let runBlockIndent: number | null = null;
  let runBlockBuffer: string[] = [];

  const finishRunBlock = (): void => {
    if (runBlockIndent === null) {
      return;
    }
    runs.push({
      stepName: currentStepName,
      run: runBlockBuffer.join('\n')
    });
    runBlockIndent = null;
    runBlockBuffer = [];
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const lineNumber = idx + 1;
    const rawLine = lines[idx];

    if (rawLine.includes('\t')) {
      throw new Error(`${workflowFile}:${lineNumber}: tabs are not allowed in workflow YAML indentation.`);
    }

    const indent = countLeadingSpaces(rawLine);
    if (indent % 2 !== 0) {
      throw new Error(`${workflowFile}:${lineNumber}: indentation must use multiples of 2 spaces.`);
    }

    if (runBlockIndent !== null) {
      if (rawLine.trim().length === 0) {
        runBlockBuffer.push('');
        continue;
      }
      if (indent < runBlockIndent) {
        finishRunBlock();
        idx -= 1;
        continue;
      }
      runBlockBuffer.push(rawLine.slice(runBlockIndent));
      continue;
    }

    const noComment = stripComment(rawLine);
    const trimmed = noComment.trim();
    if (!trimmed) {
      continue;
    }

    if (!inJobs) {
      if (trimmed === 'jobs:') {
        inJobs = true;
      }
      continue;
    }

    if (indent < 4) {
      inSteps = false;
    }

    if (indent === 4 && trimmed === 'steps:') {
      inSteps = true;
      currentStepName = '(unnamed step)';
      currentStepIndex = 0;
      continue;
    }

    if (!inSteps) {
      continue;
    }

    if (indent === 6 && trimmed.startsWith('- ')) {
      finishRunBlock();
      currentStepIndex += 1;
      currentStepName = `unnamed-step-${currentStepIndex}`;
      const afterDash = trimmed.slice(2).trim();
      if (!afterDash) {
        continue;
      }
      const kv = parseKeyValue(afterDash);
      if (!kv) {
        throw new Error(`${workflowFile}:${lineNumber}: malformed step entry.`);
      }
      if (kv.key === 'name') {
        currentStepName = kv.value.replace(/^['"]|['"]$/g, '') || currentStepName;
      } else if (kv.key === 'run') {
        if (!kv.value) {
          throw new Error(`${workflowFile}:${lineNumber}: run step is missing a command.`);
        }
        if (kv.value.startsWith('|') || kv.value.startsWith('>')) {
          runBlockIndent = 8;
          runBlockBuffer = [];
        } else {
          runs.push({ stepName: currentStepName, run: kv.value });
        }
      }
      continue;
    }

    if (indent === 8) {
      const kv = parseKeyValue(trimmed);
      if (!kv) {
        throw new Error(`${workflowFile}:${lineNumber}: malformed mapping entry in step.`);
      }
      if (kv.key === 'name') {
        currentStepName = kv.value.replace(/^['"]|['"]$/g, '') || currentStepName;
        continue;
      }
      if (kv.key === 'run') {
        if (!kv.value) {
          throw new Error(`${workflowFile}:${lineNumber}: run step is missing a command.`);
        }
        if (kv.value.startsWith('|') || kv.value.startsWith('>')) {
          runBlockIndent = 10;
          runBlockBuffer = [];
        } else {
          runs.push({ stepName: currentStepName, run: kv.value });
        }
      }
    }
  }

  finishRunBlock();

  if (!inJobs) {
    throw new Error(`${workflowFile}: missing jobs: section.`);
  }

  return { runs };
}

function listWorkflowFiles(repoRoot: string): string[] {
  const workflowsDir = path.join(repoRoot, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  return fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
    .map((name) => path.join('.github', 'workflows', name));
}

function tokenizeShell(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+/g;
  const matches = command.match(pattern);
  if (!matches) {
    return tokens;
  }

  for (const token of matches) {
    if (token.startsWith('"') && token.endsWith('"')) {
      tokens.push(token.slice(1, -1));
      continue;
    }
    if (token.startsWith("'") && token.endsWith("'")) {
      tokens.push(token.slice(1, -1));
      continue;
    }
    tokens.push(token);
  }
  return tokens;
}

function extractNodeEntrypoints(run: string): string[] {
  const entrypoints: string[] = [];
  const lines = run.split(/\r?\n/);

  for (const line of lines) {
    const commands = line.split(/&&|\|\||\|/);
    for (const command of commands) {
      const tokens = tokenizeShell(command.trim());
      for (let index = 0; index < tokens.length; index += 1) {
        if (tokens[index] !== 'node') {
          continue;
        }

        for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
          const token = tokens[cursor];
          if (!token || token === ';') {
            break;
          }
          if (token.startsWith('-')) {
            continue;
          }
          if (token.endsWith('.ts') || token.endsWith('.js')) {
            entrypoints.push(token);
          }
          break;
        }
      }
    }
  }

  return entrypoints;
}

export function verifyWorkflows(options: VerifyOptions = {}): {
  filesChecked: number;
  failures: VerificationFailure[];
} {
  const repoRoot = options.repoRoot ?? process.cwd();
  const allowlist = new Set(options.allowlist ?? DEFAULT_ALLOWLIST);
  const workflowFiles = listWorkflowFiles(repoRoot);
  const failures: VerificationFailure[] = [];

  for (const workflowFile of workflowFiles) {
    const absolutePath = path.join(repoRoot, workflowFile);
    const content = fs.readFileSync(absolutePath, 'utf8');

    let parsed: WorkflowParseResult;
    try {
      parsed = parseWorkflowRuns(content, workflowFile);
    } catch (error) {
      failures.push({
        type: 'parse',
        workflowFile,
        stepName: '(parse)',
        message: (error as Error).message
      });
      continue;
    }

    for (const runStep of parsed.runs) {
      const entrypoints = extractNodeEntrypoints(runStep.run);
      for (const entrypoint of entrypoints) {
        const normalized = entrypoint.replace(/^\.\//, '');
        const exists = fs.existsSync(path.join(repoRoot, normalized));
        if (!exists) {
          failures.push({
            type: 'missing',
            workflowFile,
            stepName: runStep.stepName,
            entrypoint: normalized,
            message: `Missing node entrypoint: ${normalized}`
          });
          continue;
        }
        if (!allowlist.has(normalized)) {
          failures.push({
            type: 'disallowed',
            workflowFile,
            stepName: runStep.stepName,
            entrypoint: normalized,
            message: `Disallowed node entrypoint: ${normalized}`
          });
        }
      }
    }
  }

  return {
    filesChecked: workflowFiles.length,
    failures
  };
}

function printFailures(failures: VerificationFailure[]): void {
  const grouped = new Map<string, VerificationFailure[]>();
  for (const failure of failures) {
    const key = `${failure.workflowFile} :: ${failure.stepName}`;
    const current = grouped.get(key) ?? [];
    current.push(failure);
    grouped.set(key, current);
  }

  for (const [scope, scopeFailures] of grouped.entries()) {
    console.error(scope);
    for (const failure of scopeFailures) {
      console.error(`  - ${failure.message}`);
    }
  }
}

function main(): void {
  const result = verifyWorkflows();
  if (result.failures.length > 0) {
    printFailures(result.failures);
    console.error(
      'Workflow integrity verification failed. Ensure workflow YAML parses and only canonical node entrypoints are referenced.'
    );
    process.exit(1);
  }

  console.log(`Workflow integrity OK. Files checked: ${result.filesChecked}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseWorkflowRuns, extractNodeEntrypoints, DEFAULT_ALLOWLIST };
