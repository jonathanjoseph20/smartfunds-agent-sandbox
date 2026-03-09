export type ArtifactPreviewKind = 'markdown' | 'csv' | 'json' | 'text' | 'unsupported';

export interface RunSummary {
  runId: string;
  missionId?: string;
  status?: string;
}

export interface ArtifactSummary {
  fileName: string;
  previewKind: ArtifactPreviewKind;
  sizeBytes?: number;
}

export interface RunDetails {
  runId: string;
  missionId?: string;
  workflowId?: string;
  status?: string;
  nodes?: string[];
  artifacts: ArtifactSummary[];
}

export type ArtifactPreviewContent =
  | { markdown: string; html: string }
  | { csv: { headers: string[]; rows: string[][] } }
  | { json: unknown; pretty: string }
  | { text: string }
  | { unsupportedReason: string };

export interface ArtifactPreviewResponse {
  runId: string;
  fileName: string;
  previewKind: ArtifactPreviewKind;
  content: ArtifactPreviewContent;
}

export type ArtifactLoaderErrorCode = 'RUN_NOT_FOUND' | 'ARTIFACT_NOT_FOUND' | 'INVALID_ARTIFACT_PATH';

export class ArtifactLoaderError extends Error {
  readonly code: ArtifactLoaderErrorCode;

  constructor(code: ArtifactLoaderErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
