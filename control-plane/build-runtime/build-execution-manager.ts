import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createCodexExecutionPacketManager,
  type CodexExecutionPacketManager,
} from '../codex/codex-execution-packet-manager.ts';
import type { CodexExecutionPacket } from '../codex/codex-execution-packet-types.ts';
import {
  createRepoScaffoldManager,
  type RepoScaffoldManager,
} from '../repo-scaffold/repo-scaffold-manager.ts';
import type { RepositoryScaffoldBundle } from '../repo-scaffold/repo-scaffold-types.ts';

import { inferArtifactTypeFromPath } from './build-execution-artifacts.ts';
import {
  deriveBuildExecutionRunId,
  type BuildExecutionIdentityPayload,
} from './build-execution-identity.ts';
import {
  createBuildExecutionHistoryStore,
  type BuildExecutionHistoryStore,
} from './build-execution-history-store.ts';
import { latestValidation, listBuildExecutionProjections, projectBuildExecutionRun } from './build-execution-projection.ts';
import {
  createBuildExecutionRunner,
  type BuildExecutionRunner,
} from './build-execution-runner.ts';
import { assertBuildExecutionCanStart, deriveBuildExecutionStatus } from './build-execution-status.ts';
import type {
  ArtifactType,
  BuildExecutionCreateSummary,
  BuildExecutionHistoryEvent,
  BuildExecutionHistoryEventType,
  BuildExecutionProjection,
  BuildExecutionRun,
  BuildExecutionStatus,
  ExecutionPlan,
  ExecutionStep,
  OperationType,
  ValidationResult,
} from './build-execution-types.ts';
import { validateBuildExecutionRun as validateBuildExecutionRunDefinition } from './build-execution-validation.ts';

const DEFAULT_BUILD_EXECUTION_RUNS_FILE = path.join(
  'runtime-data',
  'build-runtime',
  'build-execution-runs.json',
);

type BuildExecutionRunStore = {
  runs: BuildExecutionRun[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseStatus(value: unknown): BuildExecutionStatus | null {
  return value === 'draft' || value === 'ready' || value === 'running' || value === 'completed' || value === 'failed'
    ? value
    : null;
}

function parseArtifactType(value: unknown): ArtifactType | null {
  return value === 'sourceFile'
    || value === 'testFile'
    || value === 'configFile'
    || value === 'docFile'
    || value === 'patch'
    ? value
    : null;
}

function parseOperationType(value: unknown): OperationType | null {
  return value === 'generateFile'
    || value === 'modifyFile'
    || value === 'appendFile'
    || value === 'generateTest'
    || value === 'generateDocs'
    || value === 'generateConfig'
    ? value
    : null;
}

function parseExecutionStep(value: unknown): ExecutionStep {
  if (!isRecord(value)) {
    throw new Error('BUILD_EXECUTION_INVALID_STEP');
  }

  const stepId = asString(value.stepId);
  const operationType = parseOperationType(value.operationType);
  const targetPath = asString(value.targetPath);
  const promptTemplate = normalizeString(value.promptTemplate);

  if (!stepId || !operationType || !targetPath) {
    throw new Error('BUILD_EXECUTION_INVALID_STEP');
  }

  const expectedArtifacts = Array.isArray(value.expectedArtifacts)
    ? value.expectedArtifacts
      .map((entry) => parseArtifactType(entry))
      .filter((entry): entry is ArtifactType => entry !== null)
      .sort((left, right) => left.localeCompare(right))
    : [];

  return {
    stepId,
    operationType,
    targetPath,
    promptTemplate,
    expectedArtifacts,
  };
}

function parseValidationResult(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    throw new Error('BUILD_EXECUTION_INVALID_VALIDATION');
  }

  const validationState = value.validationState;
  if (validationState !== 'valid' && validationState !== 'invalid' && validationState !== 'warning') {
    throw new Error('BUILD_EXECUTION_INVALID_VALIDATION');
  }

  const toSortedStrings = (input: unknown): string[] => {
    if (!Array.isArray(input)) {
      return [];
    }

    return input
      .filter((entry): entry is string => typeof entry === 'string')
      .sort((left, right) => left.localeCompare(right));
  };

  return {
    validationState,
    missingFields: toSortedStrings(value.missingFields),
    violations: toSortedStrings(value.violations),
    warnings: toSortedStrings(value.warnings),
  };
}

function parseGeneratedArtifact(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('BUILD_EXECUTION_INVALID_ARTIFACT');
  }

  const artifactId = asString(value.artifactId);
  const artifactType = parseArtifactType(value.artifactType);
  const filePath = asString(value.filePath);
  const contentHash = asString(value.contentHash);
  const contentSize = typeof value.contentSize === 'number' ? value.contentSize : null;

  if (!artifactId || !artifactType || !filePath || !contentHash || contentSize === null) {
    throw new Error('BUILD_EXECUTION_INVALID_ARTIFACT');
  }

  return {
    artifactId,
    artifactType,
    filePath,
    contentHash,
    contentSize,
  };
}

function parseRun(value: unknown): BuildExecutionRun {
  if (!isRecord(value)) {
    throw new Error('BUILD_EXECUTION_INVALID_RUN');
  }

  const runId = asString(value.runId);
  const packetId = asString(value.packetId);
  const bundleId = asString(value.bundleId);
  const graphId = asString(value.graphId);
  const taskId = asString(value.taskId);
  const repoTarget = asString(value.repoTarget);
  const status = parseStatus(value.status);

  if (!runId || !packetId || !bundleId || !graphId || !taskId || !repoTarget || !status || !isRecord(value.executionPlan)) {
    throw new Error('BUILD_EXECUTION_INVALID_RUN');
  }

  return {
    runId,
    packetId,
    bundleId,
    graphId,
    taskId,
    repoTarget,
    executionPlan: {
      steps: Array.isArray(value.executionPlan.steps)
        ? value.executionPlan.steps.map((entry) => parseExecutionStep(entry)).sort((left, right) => left.stepId.localeCompare(right.stepId))
        : [],
    },
    generatedArtifacts: Array.isArray(value.generatedArtifacts)
      ? value.generatedArtifacts.map((entry) => parseGeneratedArtifact(entry)).sort((left, right) => left.artifactId.localeCompare(right.artifactId))
      : [],
    validationResults: Array.isArray(value.validationResults)
      ? value.validationResults.map((entry) => parseValidationResult(entry))
      : [],
    status,
  };
}

function readStore(filePath: string): BuildExecutionRunStore {
  if (!fs.existsSync(filePath)) {
    return { runs: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('BUILD_EXECUTION_INVALID_STORE');
  }

  const runs = Array.isArray(parsed.runs)
    ? parsed.runs.map((entry) => parseRun(entry)).sort((left, right) => left.runId.localeCompare(right.runId))
    : [];

  return { runs };
}

function writeStore(filePath: string, store: BuildExecutionRunStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    runs: [...store.runs].sort((left, right) => left.runId.localeCompare(right.runId)),
  })}\n`, 'utf8');
}

function toPayloadHash(payload: unknown): string {
  return sha256(canonicalStringify(payload));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function deriveOperationTypeForPath(filePath: string): OperationType {
  const normalized = normalizePath(filePath).toLowerCase();
  if (normalized.endsWith('.patch') || normalized.endsWith('.diff')) {
    return 'modifyFile';
  }
  if (normalized.startsWith('tests/') || normalized.includes('/tests/') || normalized.includes('.test.')) {
    return 'generateTest';
  }
  if (normalized.startsWith('docs/') || normalized.includes('/docs/') || normalized.endsWith('.md')) {
    return 'generateDocs';
  }
  if (normalized.startsWith('config/') || normalized.includes('/config/')) {
    return 'generateConfig';
  }
  return 'generateFile';
}

function deriveStepPromptTemplate(input: {
  packet: Pick<CodexExecutionPacket, 'promptTemplate' | 'taskId' | 'graphId'>;
  bundle: Pick<RepositoryScaffoldBundle, 'bundleId' | 'repoTarget' | 'workspaceLayout'>;
  targetPath: string;
  operationType: OperationType;
  expectedArtifacts: ArtifactType[];
}): string {
  return [
    `Execute task ${input.packet.taskId} for target ${input.targetPath}.`,
    `Operation: ${input.operationType}.`,
    `Expected Artifacts: ${input.expectedArtifacts.join(', ')}.`,
    `Graph: ${input.packet.graphId}.`,
    `Bundle: ${input.bundle.bundleId}.`,
    `Repo Target: ${input.bundle.repoTarget}.`,
    `Workspace Root: ${input.bundle.workspaceLayout.root}.`,
    '',
    input.packet.promptTemplate,
  ].join('\n');
}

export function deriveExecutionPlanFromPacketAndBundle(input: {
  packet: CodexExecutionPacket;
  bundle: RepositoryScaffoldBundle;
}): ExecutionPlan {
  const candidatePaths = uniqueSorted([
    ...input.bundle.files,
    ...input.bundle.patchTargets,
    ...input.packet.expectedArtifacts,
  ].map((entry) => normalizePath(entry)).filter((entry) => entry.length > 0));

  const steps = candidatePaths.map((targetPath) => {
    const operationType = deriveOperationTypeForPath(targetPath);
    const expectedArtifacts = [inferArtifactTypeFromPath(targetPath)];
    const promptTemplate = deriveStepPromptTemplate({
      packet: input.packet,
      bundle: input.bundle,
      targetPath,
      operationType,
      expectedArtifacts,
    });

    const stepId = sha256(canonicalStringify({
      packetId: input.packet.packetId,
      bundleId: input.bundle.bundleId,
      targetPath,
      operationType,
      expectedArtifacts,
      promptTemplate,
    }));

    return {
      stepId,
      operationType,
      targetPath,
      promptTemplate,
      expectedArtifacts,
    } satisfies ExecutionStep;
  }).sort((left, right) => left.stepId.localeCompare(right.stepId));

  return { steps };
}

function toIdentityPayload(input: {
  packetId: string;
  bundleId: string;
  executionPlan: ExecutionPlan;
  repoTarget: string;
}): BuildExecutionIdentityPayload {
  return {
    packetId: input.packetId,
    bundleId: input.bundleId,
    executionPlan: {
      steps: [...input.executionPlan.steps].sort((left, right) => left.stepId.localeCompare(right.stepId)),
    },
    repoTarget: normalizePath(input.repoTarget),
  };
}

function resolveMaterializationPaths(input: { runId: string; artifactsRoot?: string }) {
  const normalizedRunId = input.runId.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedRunId.length === 0 || normalizedRunId.includes('/') || normalizedRunId.includes('..')) {
    throw new Error(`INVALID_BUILD_EXECUTION_RUN_ID: ${input.runId}`);
  }

  const root = path.resolve(input.artifactsRoot ?? path.join('artifacts', 'build-runtime'));
  const dirPath = path.join(root, normalizedRunId);

  return {
    dirPath,
    runPath: path.join(dirPath, 'build-execution-run.json'),
    statusPath: path.join(dirPath, 'build-execution-status.json'),
    generatedArtifactsPath: path.join(dirPath, 'generated-artifacts.json'),
    executionStepsPath: path.join(dirPath, 'execution-steps.json'),
    reportPath: path.join(dirPath, 'execution-report.md'),
  };
}

function toReportMarkdown(input: {
  run: BuildExecutionRun;
  validation: ValidationResult;
  history: BuildExecutionHistoryEvent[];
}): string {
  const steps = [...input.run.executionPlan.steps].sort((left, right) => left.stepId.localeCompare(right.stepId));
  const artifacts = [...input.run.generatedArtifacts].sort((left, right) => left.artifactId.localeCompare(right.artifactId));

  return [
    '# Build Execution Report',
    '',
    `- runId: ${input.run.runId}`,
    `- packetId: ${input.run.packetId}`,
    `- bundleId: ${input.run.bundleId}`,
    `- graphId: ${input.run.graphId}`,
    `- taskId: ${input.run.taskId}`,
    `- repoTarget: ${input.run.repoTarget}`,
    `- status: ${input.run.status}`,
    `- validationState: ${input.validation.validationState}`,
    `- historyEvents: ${input.history.length}`,
    '',
    '## Validation',
    `- missingFields: ${input.validation.missingFields.join(', ') || 'none'}`,
    `- violations: ${input.validation.violations.join(', ') || 'none'}`,
    `- warnings: ${input.validation.warnings.join(', ') || 'none'}`,
    '',
    '## Steps',
    ...steps.map((step) => `- ${step.stepId} ${step.operationType} ${step.targetPath}`),
    '',
    '## Artifacts',
    ...artifacts.map((artifact) => `- ${artifact.artifactId} ${artifact.artifactType} ${artifact.filePath} ${artifact.contentHash}`),
    '',
  ].join('\n');
}

export function createBuildExecutionManager(options: {
  runsFilePath?: string;
  historyStore?: BuildExecutionHistoryStore;
  historyFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  bundlesFilePath?: string;
  bundleHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  runner?: BuildExecutionRunner;
  artifactsRoot?: string;
} = {}) {
  const runsFilePath = options.runsFilePath ?? DEFAULT_BUILD_EXECUTION_RUNS_FILE;
  const historyStore = options.historyStore ?? createBuildExecutionHistoryStore({
    historyFilePath: options.historyFilePath,
  });

  const packetManager = createCodexExecutionPacketManager({
    packetsFilePath: options.packetsFilePath,
    historyFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const scaffoldManager = createRepoScaffoldManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.bundleHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const runner = options.runner ?? createBuildExecutionRunner();

  function getBuildExecutionRun(runId: string): BuildExecutionRun {
    const run = readStore(runsFilePath).runs.find((entry) => entry.runId === runId);
    if (!run) {
      throw new Error(`BUILD_EXECUTION_RUN_NOT_FOUND: ${runId}`);
    }

    return run;
  }

  function listBuildExecutionRuns(): BuildExecutionRun[] {
    return readStore(runsFilePath).runs;
  }

  function appendBuildExecutionEvent(input: {
    runId: string;
    eventType: BuildExecutionHistoryEventType;
    payload: Record<string, unknown>;
  }) {
    return historyStore.appendBuildExecutionEvent({
      runId: input.runId,
      eventType: input.eventType,
      payloadHash: toPayloadHash(input.payload),
      payload: JSON.parse(canonicalStringify(input.payload)) as Record<string, unknown>,
    });
  }

  function createBuildExecutionRun(packetId: string, bundleId: string): BuildExecutionCreateSummary {
    const packet = packetManager.getCodexExecutionPacket(packetId);
    const bundle = scaffoldManager.getRepoScaffoldBundle(bundleId);

    const executionPlan = deriveExecutionPlanFromPacketAndBundle({
      packet,
      bundle,
    });

    const identityPayload = toIdentityPayload({
      packetId,
      bundleId,
      executionPlan,
      repoTarget: bundle.repoTarget,
    });

    const runId = deriveBuildExecutionRunId(identityPayload);
    const store = readStore(runsFilePath);
    const existing = store.runs.find((entry) => entry.runId === runId);
    if (existing) {
      return {
        runId: existing.runId,
        packetId: existing.packetId,
        bundleId: existing.bundleId,
      };
    }

    const runWithoutValidation: BuildExecutionRun = {
      runId,
      packetId,
      bundleId,
      graphId: packet.graphId,
      taskId: packet.taskId,
      repoTarget: bundle.repoTarget,
      executionPlan,
      generatedArtifacts: [],
      validationResults: [],
      status: 'draft',
    };

    const validation = validateBuildExecutionRunDefinition({
      run: runWithoutValidation,
      packetManager,
      scaffoldManager,
    });

    const history = historyStore.listBuildExecutionEvents(runId);
    const status = deriveBuildExecutionStatus({ validation, history });

    const run: BuildExecutionRun = {
      ...runWithoutValidation,
      validationResults: [validation],
      status,
    };

    writeStore(runsFilePath, {
      runs: [...store.runs, run],
    });

    appendBuildExecutionEvent({
      runId,
      eventType: 'build_execution_created',
      payload: {
        runId,
        packetId,
        bundleId,
        graphId: run.graphId,
        taskId: run.taskId,
      },
    });

    return {
      runId,
      packetId,
      bundleId,
    };
  }

  function validateBuildExecutionRun(runId: string): ValidationResult {
    const run = getBuildExecutionRun(runId);
    const validation = validateBuildExecutionRunDefinition({
      run,
      packetManager,
      scaffoldManager,
    });

    const store = readStore(runsFilePath);
    const index = store.runs.findIndex((entry) => entry.runId === runId);
    if (index >= 0) {
      const history = historyStore.listBuildExecutionEvents(runId);
      const status = deriveBuildExecutionStatus({ validation, history });
      const previous = store.runs[index]!;

      const next: BuildExecutionRun = {
        ...previous,
        validationResults: [...previous.validationResults, validation],
        status,
      };

      const runs = [...store.runs];
      runs[index] = next;
      writeStore(runsFilePath, { runs });
    }

    return validation;
  }

  function deriveBuildExecutionProjection(runId: string): BuildExecutionProjection {
    const run = getBuildExecutionRun(runId);
    const validation = latestValidation(run.validationResults);
    const history = historyStore.listBuildExecutionEvents(runId);

    return projectBuildExecutionRun({
      run,
      validation,
      history,
    });
  }

  function listBuildExecutionRunProjections(): BuildExecutionProjection[] {
    return listBuildExecutionProjections({
      runs: listBuildExecutionRuns(),
      getHistory: (runId) => historyStore.listBuildExecutionEvents(runId),
    });
  }

  function executeBuildRun(runId: string): BuildExecutionProjection {
    const run = getBuildExecutionRun(runId);
    const packet = packetManager.getCodexExecutionPacket(run.packetId);
    const bundle = scaffoldManager.getRepoScaffoldBundle(run.bundleId);
    const initialValidation = validateBuildExecutionRunDefinition({
      run,
      packetManager,
      scaffoldManager,
    });
    const initialHistory = historyStore.listBuildExecutionEvents(runId);
    const initialStatus = deriveBuildExecutionStatus({
      validation: initialValidation,
      history: initialHistory,
    });

    assertBuildExecutionCanStart(initialStatus);

    appendBuildExecutionEvent({
      runId,
      eventType: 'build_execution_started',
      payload: {
        runId,
        packetId: run.packetId,
        bundleId: run.bundleId,
      },
    });

    const store = readStore(runsFilePath);
    const index = store.runs.findIndex((entry) => entry.runId === runId);
    if (index < 0) {
      throw new Error(`BUILD_EXECUTION_RUN_NOT_FOUND: ${runId}`);
    }

    const startedRun: BuildExecutionRun = {
      ...store.runs[index]!,
      status: 'running',
      validationResults: [...store.runs[index]!.validationResults, initialValidation],
    };

    const startedRuns = [...store.runs];
    startedRuns[index] = startedRun;
    writeStore(runsFilePath, { runs: startedRuns });

    try {
      const outcome = runner.executeRun({
        run: startedRun,
        packet,
        bundle,
      });

      for (const stepResult of outcome.stepResults) {
        appendBuildExecutionEvent({
          runId,
          eventType: 'build_execution_step_completed',
          payload: {
            runId,
            stepId: stepResult.stepId,
            artifactIds: stepResult.artifactIds,
          },
        });
      }

      const executionFailed = outcome.validation.validationState === 'invalid';

      appendBuildExecutionEvent({
        runId,
        eventType: executionFailed ? 'build_execution_failed' : 'build_execution_completed',
        payload: {
          runId,
          validationState: outcome.validation.validationState,
          artifactCount: outcome.generatedArtifacts.length,
          violations: outcome.validation.violations,
        },
      });

      const refreshedStore = readStore(runsFilePath);
      const refreshedIndex = refreshedStore.runs.findIndex((entry) => entry.runId === runId);
      if (refreshedIndex >= 0) {
        const nextRun: BuildExecutionRun = {
          ...refreshedStore.runs[refreshedIndex]!,
          generatedArtifacts: outcome.generatedArtifacts,
          validationResults: [...refreshedStore.runs[refreshedIndex]!.validationResults, outcome.validation],
          status: executionFailed ? 'failed' : 'completed',
        };

        const runs = [...refreshedStore.runs];
        runs[refreshedIndex] = nextRun;
        writeStore(runsFilePath, { runs });
      }

      return deriveBuildExecutionProjection(runId);
    } catch (error) {
      appendBuildExecutionEvent({
        runId,
        eventType: 'build_execution_failed',
        payload: {
          runId,
          error: (error as Error).message,
        },
      });

      const failedStore = readStore(runsFilePath);
      const failedIndex = failedStore.runs.findIndex((entry) => entry.runId === runId);
      if (failedIndex >= 0) {
        const nextRun: BuildExecutionRun = {
          ...failedStore.runs[failedIndex]!,
          status: 'failed',
          validationResults: [...failedStore.runs[failedIndex]!.validationResults, {
            validationState: 'invalid',
            missingFields: [],
            violations: ['execution_runner_failure'],
            warnings: [],
          }],
        };

        const runs = [...failedStore.runs];
        runs[failedIndex] = nextRun;
        writeStore(runsFilePath, { runs });
      }

      return deriveBuildExecutionProjection(runId);
    }
  }

  function materializeBuildExecutionArtifacts(runId: string) {
    const run = getBuildExecutionRun(runId);
    const validation = latestValidation(run.validationResults);
    const history = historyStore.listBuildExecutionEvents(runId);
    const paths = resolveMaterializationPaths({
      runId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });
    fs.writeFileSync(paths.runPath, `${canonicalStringify(run)}\n`, 'utf8');
    fs.writeFileSync(paths.statusPath, `${canonicalStringify({
      runId: run.runId,
      packetId: run.packetId,
      bundleId: run.bundleId,
      status: run.status,
      validationState: validation.validationState,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.generatedArtifactsPath, `${canonicalStringify(run.generatedArtifacts)}\n`, 'utf8');
    fs.writeFileSync(paths.executionStepsPath, `${canonicalStringify(run.executionPlan.steps)}\n`, 'utf8');
    fs.writeFileSync(paths.reportPath, `${toReportMarkdown({ run, validation, history })}\n`, 'utf8');

    appendBuildExecutionEvent({
      runId,
      eventType: 'build_execution_artifacts_materialized',
      payload: {
        runId,
        dirPath: paths.dirPath,
      },
    });

    return {
      runId,
      dirPath: paths.dirPath,
      runPath: paths.runPath,
      statusPath: paths.statusPath,
      generatedArtifactsPath: paths.generatedArtifactsPath,
      executionStepsPath: paths.executionStepsPath,
      reportPath: paths.reportPath,
    };
  }

  return {
    historyStore,
    packetManager,
    scaffoldManager,
    getBuildExecutionRun,
    listBuildExecutionRuns,
    createBuildExecutionRun,
    validateBuildExecutionRun,
    executeBuildRun,
    appendBuildExecutionEvent,
    deriveBuildExecutionProjection,
    listBuildExecutionRunProjections,
    materializeBuildExecutionArtifacts,
  };
}

export type BuildExecutionManager = ReturnType<typeof createBuildExecutionManager>;
