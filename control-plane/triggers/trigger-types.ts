export type TriggerDefinition = {
  triggerId: string;
  signalType: string;
  mission: string;
  cooldownSlots: number;
};

export type TriggerRecord = {
  triggerId: string;
  signalReference: string;
  missionLaunched: string;
  slot: string;
};

export type MissionLaunchRequest = {
  missionId: string;
  triggerId: string;
  sourceSignal: string;
};

export type EvaluateSignalForTriggersResult = {
  status: 'triggered' | 'duplicate' | 'no_match';
  launchRequests: MissionLaunchRequest[];
};

export class TriggerError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TriggerError';
    this.code = code;
    this.details = details;
  }
}
