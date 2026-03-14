export type RepoScaffoldStatus = 'draft' | 'validated' | 'blocked' | 'ready';

export type RepoScaffoldValidationState = 'valid' | 'invalid' | 'incomplete';

export type WorkspaceLayout = {
  root: string;
  srcDir: string;
  testsDir: string;
  configDir: string;
  docsDir: string;
};

export type RepositoryScaffoldBundle = {
  bundleId: string;
  packetId: string;
  graphId: string;
  taskId: string;
  repoTarget: string;
  directories: string[];
  files: string[];
  patchTargets: string[];
  artifactDependencies: string[];
  workspaceLayout: WorkspaceLayout;
  status: RepoScaffoldStatus;
};

export type RepoScaffoldValidationResult = {
  validationState: RepoScaffoldValidationState;
  missingFields: string[];
  violations: string[];
  warnings: string[];
};

export type RepoScaffoldProjection = {
  bundleId: string;
  packetId: string;
  graphId: string;
  taskId: string;
  repoTarget: string;
  status: RepoScaffoldStatus;
  validationState: RepoScaffoldValidationState;
  directoryCount: number;
  fileCount: number;
  patchTargetCount: number;
  artifactDependencyCount: number;
  rootDir: string;
  warningsCount: number;
  violationsCount: number;
};

export type RepoScaffoldHistoryEventType =
  | 'repo_scaffold_created'
  | 'repo_scaffold_updated'
  | 'repo_scaffold_validated'
  | 'repo_scaffold_materialized'
  | 'repo_scaffold_status_changed';

export type RepoScaffoldHistoryEvent = {
  bundleId: string;
  eventType: RepoScaffoldHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
};

export type RepoScaffoldFileLayout = {
  bundleId: string;
  repoTarget: string;
  declaredDirectories: string[];
  derivedDirectories: string[];
  allDirectories: string[];
  files: string[];
  fileToDirectory: Array<{ file: string; directory: string }>;
};

export type RepoScaffoldPatchPlan = {
  bundleId: string;
  patchTargets: string[];
  missingFromFiles: string[];
  fileCount: number;
  patchTargetCount: number;
};

export type RepoScaffoldInspectionView = {
  bundle: RepositoryScaffoldBundle;
  validation: RepoScaffoldValidationResult;
  status: RepoScaffoldStatus;
  projection: RepoScaffoldProjection;
  fileLayout: RepoScaffoldFileLayout;
  patchPlan: RepoScaffoldPatchPlan;
  history: RepoScaffoldHistoryEvent[];
};

export type RepoScaffoldMaterializationSummary = {
  bundleId: string;
  dirPath: string;
  bundlePath: string;
  statusPath: string;
  validationPath: string;
  fileLayoutPath: string;
  patchPlanPath: string;
  reportPath: string;
};
