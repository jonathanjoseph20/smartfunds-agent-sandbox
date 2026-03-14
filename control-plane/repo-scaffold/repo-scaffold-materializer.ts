import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createRepoScaffoldManager,
  type RepoScaffoldManager,
} from './repo-scaffold-manager.ts';
import { buildRepoScaffoldFileLayout } from './repo-scaffold-file-layout.ts';
import { buildRepoScaffoldPatchPlan } from './repo-scaffold-patch-plan.ts';

const DEFAULT_REPO_SCAFFOLD_ARTIFACTS_ROOT = path.join('artifacts', 'repo-scaffold');

function normalizeRelativeSegment(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');

  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_REPO_SCAFFOLD_BUNDLE_ID: ${value}`);
  }

  return normalized;
}

export function resolveRepoScaffoldArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_REPO_SCAFFOLD_ARTIFACTS_ROOT);
}

export function resolveRepoScaffoldArtifactPaths(input: {
  bundleId: string;
  artifactsRoot?: string;
}) {
  const bundleId = normalizeRelativeSegment(input.bundleId);
  const dirPath = path.join(resolveRepoScaffoldArtifactsRoot(input.artifactsRoot), bundleId);

  return {
    dirPath,
    bundlePath: path.join(dirPath, 'repo-scaffold-bundle.json'),
    statusPath: path.join(dirPath, 'repo-scaffold-status.json'),
    validationPath: path.join(dirPath, 'repo-scaffold-validation.json'),
    fileLayoutPath: path.join(dirPath, 'repo-scaffold-file-layout.json'),
    patchPlanPath: path.join(dirPath, 'repo-scaffold-patch-plan.json'),
    reportPath: path.join(dirPath, 'repo-scaffold-report.md'),
  };
}

function toMarkdownReport(input: {
  bundleId: string;
  packetId: string;
  graphId: string;
  taskId: string;
  repoTarget: string;
  workspaceLayout: Record<string, string>;
  directories: string[];
  files: string[];
  patchTargets: string[];
  artifactDependencies: string[];
  validationState: string;
  status: string;
}): string {
  const directories = input.directories.length > 0 ? input.directories : ['none'];
  const files = input.files.length > 0 ? input.files : ['none'];
  const patchTargets = input.patchTargets.length > 0 ? input.patchTargets : ['none'];
  const artifactDependencies = input.artifactDependencies.length > 0 ? input.artifactDependencies : ['none'];

  return [
    '# Repository Scaffold Report',
    '',
    `- bundleId: ${input.bundleId}`,
    `- packetId: ${input.packetId}`,
    `- graphId: ${input.graphId}`,
    `- taskId: ${input.taskId}`,
    `- repoTarget: ${input.repoTarget}`,
    `- validationState: ${input.validationState}`,
    `- status: ${input.status}`,
    '',
    '## Workspace Layout',
    ...Object.entries(input.workspaceLayout)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Directories',
    ...directories.map((entry) => `- ${entry}`),
    '',
    '## Files',
    ...files.map((entry) => `- ${entry}`),
    '',
    '## Patch Targets',
    ...patchTargets.map((entry) => `- ${entry}`),
    '',
    '## Artifact Dependencies',
    ...artifactDependencies.map((entry) => `- ${entry}`),
    '',
  ].join('\n');
}

export function createRepoScaffoldMaterializer(options: {
  manager?: RepoScaffoldManager;
  artifactsRoot?: string;
  bundlesFilePath?: string;
  historyFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const manager = options.manager ?? createRepoScaffoldManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.historyFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function materializeRepoScaffoldBundle(bundleId: string) {
    const bundle = manager.getRepoScaffoldBundle(bundleId);
    const validation = manager.validateRepoScaffoldBundle(bundleId);
    const status = manager.deriveRepoScaffoldStatus(bundleId);
    const fileLayout = buildRepoScaffoldFileLayout(bundle);
    const patchPlan = buildRepoScaffoldPatchPlan(bundle);

    const paths = resolveRepoScaffoldArtifactPaths({
      bundleId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    fs.writeFileSync(paths.bundlePath, `${canonicalStringify(bundle)}\n`, 'utf8');
    fs.writeFileSync(paths.statusPath, `${canonicalStringify({
      bundleId: bundle.bundleId,
      packetId: bundle.packetId,
      graphId: bundle.graphId,
      taskId: bundle.taskId,
      status,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.validationPath, `${canonicalStringify(validation)}\n`, 'utf8');
    fs.writeFileSync(paths.fileLayoutPath, `${canonicalStringify(fileLayout)}\n`, 'utf8');
    fs.writeFileSync(paths.patchPlanPath, `${canonicalStringify(patchPlan)}\n`, 'utf8');
    fs.writeFileSync(paths.reportPath, toMarkdownReport({
      bundleId: bundle.bundleId,
      packetId: bundle.packetId,
      graphId: bundle.graphId,
      taskId: bundle.taskId,
      repoTarget: bundle.repoTarget,
      workspaceLayout: bundle.workspaceLayout,
      directories: [...bundle.directories].sort((left, right) => left.localeCompare(right)),
      files: [...bundle.files].sort((left, right) => left.localeCompare(right)),
      patchTargets: [...bundle.patchTargets].sort((left, right) => left.localeCompare(right)),
      artifactDependencies: [...bundle.artifactDependencies].sort((left, right) => left.localeCompare(right)),
      validationState: validation.validationState,
      status,
    }), 'utf8');

    manager.appendRepoScaffoldEvent({
      bundleId: bundle.bundleId,
      eventType: 'repo_scaffold_materialized',
      payloadHash: sha256(canonicalStringify({
        bundleId: bundle.bundleId,
        dirPath: paths.dirPath,
      })),
      payload: {
        bundleId: bundle.bundleId,
        dirPath: paths.dirPath,
      },
    });

    return {
      bundleId: bundle.bundleId,
      dirPath: paths.dirPath,
      bundlePath: paths.bundlePath,
      statusPath: paths.statusPath,
      validationPath: paths.validationPath,
      fileLayoutPath: paths.fileLayoutPath,
      patchPlanPath: paths.patchPlanPath,
      reportPath: paths.reportPath,
    };
  }

  return {
    materializeRepoScaffoldBundle,
  };
}

export type RepoScaffoldMaterializer = ReturnType<typeof createRepoScaffoldMaterializer>;
