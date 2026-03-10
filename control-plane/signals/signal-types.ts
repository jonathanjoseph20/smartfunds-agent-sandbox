export type SignalPrimitiveType = 'string' | 'number' | 'boolean';

export type SignalDefinition = {
  signalType: string;
  description: string;
  sourceMission: string;
  schema: Record<string, SignalPrimitiveType>;
  deduplicationRules: string[];
};

export interface Signal {
  signalType: string;
  sourceMission: string;
  dataset: string;
  artifactReference?: string;
  metadata: Record<string, unknown>;
}

export type SignalRecord = Signal & {
  slot: string;
  dedupeKey: string;
  logDate: string;
};

export type EmitSignalResult =
  | {
    status: 'persisted';
    signal: SignalRecord;
    path: string;
  }
  | {
    status: 'duplicate';
    signal: SignalRecord;
  };

export class SignalError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SignalError';
    this.code = code;
    this.details = details;
  }
}
