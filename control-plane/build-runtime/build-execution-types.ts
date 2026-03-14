export type BuildExecutionStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed';

export type OperationType =
  | 'generateFile'
  | 'modifyFile'
  | 'appendFile'
  | 'generateTest'
  | 'generateDocs'
  | 'generateConfig';

export type ArtifactType =
  | 'sourceFile'
  | 'testFile'
  | 'configFile'
  | 'docFile'
  | 'patch';

export type ExecutionStep = {
  stepId: string;
  operationType: OperationType;
  targetPath: string;
  promptTemplate: string;
  expectedArtifacts: ArtifactType[];
};

export type ExecutionPlan = {
  steps: ExecutionStep[];
};

export type GeneratedArtifact = {
  artifactId: string;
  artifactType: ArtifactType;
  filePath: string;
  contentHash: string;
  contentSize: number;
};

export type ValidationResult = {
  validationState: 'valid' | 'invalid' | 'warning';
  missingFields: string[];
  violations: string[];
  warnings: string[];
};

export type BuildExecutionRun = {
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  repoTarget: string;
  executionPlan: ExecutionPlan;
  generatedArtifacts: GeneratedArtifact[];
  validationResults: ValidationResult[];
  status: BuildExecutionStatus;
};

export type BuildExecutionHistoryEventType =
  | 'build_execution_created'
  | 'build_execution_started'
  | 'build_execution_step_completed'
  | 'build_execution_completed'
  | 'build_execution_failed'
  | 'build_execution_artifacts_materialized';

export type BuildExecutionHistoryEvent = {
  runId: string;
  eventType: BuildExecutionHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
};

export type BuildExecutionProjection = {
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  repoTarget: string;
  status: BuildExecutionStatus;
  executionSteps: number;
  artifactCount: number;
  validationState: ValidationResult['validationState'];
  validationMissingFields: string[];
  validationViolations: string[];
  validationWarnings: string[];
  generatedArtifacts: GeneratedArtifact[];
  historySummary: {
    totalEvents: number;
    lastEventType?: BuildExecutionHistoryEventType;
  };
};

export type BuildExecutionInspectionView = {
  run: BuildExecutionRun;
  projection: BuildExecutionProjection;
  validation: ValidationResult;
  history: BuildExecutionHistoryEvent[];
};

export type BuildExecutionMaterializationSummary = {
  runId: string;
  dirPath: string;
  runPath: string;
  statusPath: string;
  generatedArtifactsPath: string;
  executionStepsPath: string;
  reportPath: string;
};

export type BuildExecutionCreateSummary = {
  runId: string;
  packetId: string;
  bundleId: string;
};
