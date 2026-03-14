import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createCodexExecutionPacketManager,
} from '../codex/codex-execution-packet-manager.ts';
import type { CodexExecutionPacket } from '../codex/codex-execution-packet-types.ts';

import {
  deriveRepoScaffoldBundleId,
  normalizeRepoScaffoldIdentityInput,
} from './repo-scaffold-identity.ts';
import {
  createRepoScaffoldHistoryStore,
  type RepoScaffoldHistoryStore,
} from './repo-scaffold-history-store.ts';
import { normalizeDirectoryList, normalizeFileList } from './repo-scaffold-file-layout.ts';
import { normalizePatchTargets } from './repo-scaffold-patch-plan.ts';
import { projectRepoScaffoldBundle } from './repo-scaffold-projection.ts';
import { deriveRepoScaffoldStatus as deriveStatus } from './repo-scaffold-status.ts';
import type {
  RepoScaffoldHistoryEvent,
  RepoScaffoldProjection,
  RepoScaffoldStatus,
  RepoScaffoldValidationResult,
  RepositoryScaffoldBundle,
  WorkspaceLayout,
} from './repo-scaffold-types.ts';
import { validateRepoScaffoldBundle as validateBundleDefinition } from './repo-scaffold-validation.ts';

const DEFAULT_REPO_SCAFFOLD_BUNDLES_FILE = path.join(
  'runtime-data',
  'repo-scaffold',
  'repo-scaffold-bundles.json',
);

type RepoScaffoldStore = {
  bundles: RepositoryScaffoldBundle[];
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSorted(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function parseStatus(value: unknown): RepoScaffoldStatus | null {
  return value === 'draft' || value === 'validated' || value === 'blocked' || value === 'ready'
    ? value
    : null;
}

function parseWorkspaceLayout(value: unknown): WorkspaceLayout {
  if (!isRecord(value)) {
    throw new Error('REPO_SCAFFOLD_INVALID_BUNDLE');
  }

  return {
    root: normalizeString(value.root),
    srcDir: normalizeString(value.srcDir),
    testsDir: normalizeString(value.testsDir),
    configDir: normalizeString(value.configDir),
    docsDir: normalizeString(value.docsDir),
  };
}

function parseBundle(value: unknown): RepositoryScaffoldBundle {
  if (!isRecord(value)) {
    throw new Error('REPO_SCAFFOLD_INVALID_BUNDLE');
  }

  const bundleId = asString(value.bundleId);
  const packetId = asString(value.packetId);
  const graphId = asString(value.graphId);
  const taskId = asString(value.taskId);
  const repoTarget = normalizeString(value.repoTarget);
  const status = parseStatus(value.status);

  if (!bundleId || !packetId || !graphId || !taskId || repoTarget.length === 0 || !status) {
    throw new Error('REPO_SCAFFOLD_INVALID_BUNDLE');
  }

  return {
    bundleId,
    packetId,
    graphId,
    taskId,
    repoTarget,
    directories: normalizeStringArray(value.directories),
    files: normalizeStringArray(value.files),
    patchTargets: normalizeStringArray(value.patchTargets),
    artifactDependencies: normalizeStringArray(value.artifactDependencies),
    workspaceLayout: parseWorkspaceLayout(value.workspaceLayout),
    status,
  };
}

function readStore(filePath: string): RepoScaffoldStore {
  if (!fs.existsSync(filePath)) {
    return { bundles: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('REPO_SCAFFOLD_INVALID_STORE');
  }

  const bundles = Array.isArray(parsed.bundles)
    ? parsed.bundles.map((entry) => parseBundle(entry)).sort((left, right) => left.bundleId.localeCompare(right.bundleId))
    : [];

  return { bundles };
}

function writeStore(filePath: string, store: RepoScaffoldStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    bundles: [...store.bundles].sort((left, right) => left.bundleId.localeCompare(right.bundleId)),
  })}\n`, 'utf8');
}

function toPayloadHash(value: unknown): string {
  return sha256(canonicalStringify(value));
}

function normalizeRepoTarget(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/');
  if (normalized.length === 0) {
    return '.';
  }
  return normalized.replace(/^\.\//, '');
}

function deriveWorkspaceLayout(_packet: CodexExecutionPacket): WorkspaceLayout {
  return {
    root: '.',
    srcDir: 'src',
    testsDir: 'tests',
    configDir: 'config',
    docsDir: 'docs',
  };
}

function deriveFilesFromPacket(packet: CodexExecutionPacket): string[] {
  return normalizeFileList(packet.expectedArtifacts);
}

function derivePatchTargetsFromPacket(packet: CodexExecutionPacket): string[] {
  const files = deriveFilesFromPacket(packet);
  const patchLike = files.filter((entry) => entry.endsWith('.patch') || entry.endsWith('.diff'));
  return normalizePatchTargets(patchLike);
}

function deriveArtifactDependenciesFromPacket(packet: CodexExecutionPacket): string[] {
  return uniqueSorted([
    ...packet.dependencies,
  ]);
}

function deriveDirectoriesFromPacket(packet: CodexExecutionPacket): string[] {
  const files = deriveFilesFromPacket(packet);
  const fromFiles = files.map((file) => {
    const index = file.lastIndexOf('/');
    return index <= 0 ? '' : file.slice(0, index);
  }).filter((entry) => entry.length > 0);

  const workspace = deriveWorkspaceLayout(packet);
  return normalizeDirectoryList([
    ...fromFiles,
    workspace.srcDir,
    workspace.testsDir,
    workspace.configDir,
    workspace.docsDir,
  ]);
}

function buildRepoScaffoldBundleFromPacket(packet: CodexExecutionPacket): {
  bundle: RepositoryScaffoldBundle;
  validation: RepoScaffoldValidationResult;
} {
  const repoTarget = normalizeRepoTarget('.');
  const directories = deriveDirectoriesFromPacket(packet);
  const files = deriveFilesFromPacket(packet);
  const patchTargets = derivePatchTargetsFromPacket(packet);
  const artifactDependencies = deriveArtifactDependenciesFromPacket(packet);
  const workspaceLayout = deriveWorkspaceLayout(packet);

  const identityInput = normalizeRepoScaffoldIdentityInput({
    packetId: packet.packetId,
    repoTarget,
    directories,
    files,
    patchTargets,
    artifactDependencies,
    workspaceLayout,
  });

  const bundleId = deriveRepoScaffoldBundleId(identityInput);

  const bundleWithoutStatus = {
    bundleId,
    packetId: packet.packetId,
    graphId: packet.graphId,
    taskId: packet.taskId,
    repoTarget,
    directories: identityInput.directories,
    files: identityInput.files,
    patchTargets: identityInput.patchTargets,
    artifactDependencies: identityInput.artifactDependencies,
    workspaceLayout: identityInput.workspaceLayout,
  };

  const validArtifactDependencyIds = uniqueSorted([
    ...packet.dependencies,
    ...packet.expectedArtifacts,
  ]);

  const validation = validateBundleDefinition({
    bundle: bundleWithoutStatus,
    validArtifactDependencyIds,
  });

  const status = deriveStatus({
    bundle: {
      directories: bundleWithoutStatus.directories,
      files: bundleWithoutStatus.files,
      patchTargets: bundleWithoutStatus.patchTargets,
    },
    validation,
  });

  return {
    bundle: {
      ...bundleWithoutStatus,
      status,
    },
    validation,
  };
}

export function createRepoScaffoldManager(options: {
  bundlesFilePath?: string;
  historyStore?: RepoScaffoldHistoryStore;
  historyFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const bundlesFilePath = options.bundlesFilePath ?? DEFAULT_REPO_SCAFFOLD_BUNDLES_FILE;
  const historyStore = options.historyStore ?? createRepoScaffoldHistoryStore({
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

  function getRepoScaffoldBundle(bundleId: string): RepositoryScaffoldBundle {
    const bundle = readStore(bundlesFilePath).bundles.find((entry) => entry.bundleId === bundleId);
    if (!bundle) {
      throw new Error(`REPO_SCAFFOLD_BUNDLE_NOT_FOUND: ${bundleId}`);
    }

    return bundle;
  }

  function listRepoScaffoldBundles(): RepositoryScaffoldBundle[] {
    return readStore(bundlesFilePath).bundles;
  }

  function appendRepoScaffoldEvent(event: RepoScaffoldHistoryEvent) {
    return historyStore.appendRepoScaffoldEvent(event);
  }

  function createRepoScaffoldBundles(packetId: string): {
    bundleId: string;
    packetId: string;
  } {
    const packet = packetManager.getCodexExecutionPacket(packetId);
    const built = buildRepoScaffoldBundleFromPacket(packet);

    const store = readStore(bundlesFilePath);
    const existingIndex = store.bundles.findIndex((entry) => entry.bundleId === built.bundle.bundleId);
    const previousStatus = existingIndex >= 0 ? store.bundles[existingIndex]!.status : null;

    const nextBundles = [...store.bundles];

    if (existingIndex < 0) {
      nextBundles.push(built.bundle);
      appendRepoScaffoldEvent({
        bundleId: built.bundle.bundleId,
        eventType: 'repo_scaffold_created',
        payloadHash: toPayloadHash(built.bundle),
        payload: JSON.parse(canonicalStringify(built.bundle)) as Record<string, unknown>,
      });
    } else {
      nextBundles[existingIndex] = built.bundle;
      appendRepoScaffoldEvent({
        bundleId: built.bundle.bundleId,
        eventType: 'repo_scaffold_updated',
        payloadHash: toPayloadHash(built.bundle),
        payload: JSON.parse(canonicalStringify(built.bundle)) as Record<string, unknown>,
      });
    }

    appendRepoScaffoldEvent({
      bundleId: built.bundle.bundleId,
      eventType: 'repo_scaffold_validated',
      payloadHash: toPayloadHash(built.validation),
      payload: JSON.parse(canonicalStringify(built.validation)) as Record<string, unknown>,
    });

    if (previousStatus !== built.bundle.status) {
      appendRepoScaffoldEvent({
        bundleId: built.bundle.bundleId,
        eventType: 'repo_scaffold_status_changed',
        payloadHash: toPayloadHash({
          previousStatus,
          status: built.bundle.status,
        }),
        payload: {
          ...(previousStatus ? { previousStatus } : {}),
          status: built.bundle.status,
        },
      });
    }

    writeStore(bundlesFilePath, {
      bundles: nextBundles.sort((left, right) => left.bundleId.localeCompare(right.bundleId)),
    });

    return {
      bundleId: built.bundle.bundleId,
      packetId: built.bundle.packetId,
    };
  }

  function validateRepoScaffoldBundle(bundleId: string): RepoScaffoldValidationResult {
    const bundle = getRepoScaffoldBundle(bundleId);
    const packet = packetManager.getCodexExecutionPacket(bundle.packetId);

    const validation = validateBundleDefinition({
      bundle,
      validArtifactDependencyIds: uniqueSorted([
        ...packet.dependencies,
        ...packet.expectedArtifacts,
      ]),
    });

    appendRepoScaffoldEvent({
      bundleId,
      eventType: 'repo_scaffold_validated',
      payloadHash: toPayloadHash(validation),
      payload: JSON.parse(canonicalStringify(validation)) as Record<string, unknown>,
    });

    return validation;
  }

  function deriveRepoScaffoldStatus(bundleId: string): RepoScaffoldStatus {
    const bundle = getRepoScaffoldBundle(bundleId);
    const validation = validateRepoScaffoldBundle(bundleId);
    const nextStatus = deriveStatus({
      bundle: {
        directories: bundle.directories,
        files: bundle.files,
        patchTargets: bundle.patchTargets,
      },
      validation,
    });

    if (bundle.status !== nextStatus) {
      const store = readStore(bundlesFilePath);
      const index = store.bundles.findIndex((entry) => entry.bundleId === bundleId);
      if (index >= 0) {
        const nextBundle: RepositoryScaffoldBundle = {
          ...store.bundles[index]!,
          status: nextStatus,
        };

        const nextBundles = [...store.bundles];
        nextBundles[index] = nextBundle;
        writeStore(bundlesFilePath, { bundles: nextBundles });

        appendRepoScaffoldEvent({
          bundleId,
          eventType: 'repo_scaffold_status_changed',
          payloadHash: toPayloadHash({
            previousStatus: bundle.status,
            status: nextStatus,
          }),
          payload: {
            previousStatus: bundle.status,
            status: nextStatus,
          },
        });
      }
    }

    return nextStatus;
  }

  function deriveRepoScaffoldProjection(bundleId: string): RepoScaffoldProjection {
    const bundle = getRepoScaffoldBundle(bundleId);
    const packet = packetManager.getCodexExecutionPacket(bundle.packetId);
    const validation = validateBundleDefinition({
      bundle,
      validArtifactDependencyIds: uniqueSorted([
        ...packet.dependencies,
        ...packet.expectedArtifacts,
      ]),
    });

    const history = historyStore.listRepoScaffoldEvents(bundleId);

    return projectRepoScaffoldBundle({
      bundle,
      validation,
      history,
    });
  }

  function listRepoScaffoldBundleProjections(): RepoScaffoldProjection[] {
    return listRepoScaffoldBundles()
      .map((bundle) => deriveRepoScaffoldProjection(bundle.bundleId))
      .sort((left, right) => left.bundleId.localeCompare(right.bundleId));
  }

  return {
    historyStore,
    getRepoScaffoldBundle,
    listRepoScaffoldBundles,
    createRepoScaffoldBundles,
    validateRepoScaffoldBundle,
    deriveRepoScaffoldStatus,
    deriveRepoScaffoldProjection,
    listRepoScaffoldBundleProjections,
    appendRepoScaffoldEvent,
    buildRepoScaffoldBundleFromPacket,
  };
}

export type RepoScaffoldManager = ReturnType<typeof createRepoScaffoldManager>;
export { buildRepoScaffoldBundleFromPacket };
