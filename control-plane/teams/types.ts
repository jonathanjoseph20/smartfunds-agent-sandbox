export type ExecutionMode = 'structured' | 'autonomous';

export interface TeamDefinition {
  teamId: string;
  executionMode: ExecutionMode;
  ownedPaths: string[];
  description?: string;
}

export interface TeamResolutionResult {
  teamsTouched: string[];
  executionModesTouched: ExecutionMode[];
  unownedPaths: string[];
  ambiguousPaths: string[];
  modeWarnings: string[];
}

