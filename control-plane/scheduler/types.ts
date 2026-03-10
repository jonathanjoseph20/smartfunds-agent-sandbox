export type DailyCadence = {
  type: 'daily';
  hourUtc?: number;
  minuteUtc?: number;
};

export type IntervalHoursCadence = {
  type: 'interval_hours';
  every: number;
};

export type IntervalMinutesCadence = {
  type: 'interval_minutes';
  every: number;
};

export type MissionScheduleCadence = DailyCadence | IntervalHoursCadence | IntervalMinutesCadence;

export type MissionSchedule = {
  scheduleId: string;
  missionId: string;
  enabled: boolean;
  cadence: MissionScheduleCadence;
  params?: Record<string, string>;
  maxLaunchesPerSlot?: 1;
};

export type InvalidMissionSchedule = {
  scheduleId: string;
  missionId?: string;
  enabled?: boolean;
  errors: string[];
  raw: unknown;
};

export type ScheduleRegistry = {
  schemaVersion: number;
  schedules: MissionSchedule[];
  invalidSchedules: InvalidMissionSchedule[];
};

export type DueDecision =
  | 'due'
  | 'not_due'
  | 'already_launched_for_slot'
  | 'disabled'
  | 'invalid_schedule';

export type ScheduleEvaluation = {
  scheduleId: string;
  missionId: string | null;
  enabled: boolean;
  dueDecision: DueDecision;
  cadenceDescription: string;
  currentSlotId?: string;
  dueAtUtc?: string;
  nextDueUtc?: string;
  reason?: string;
};

export type ScheduleLaunchEventType =
  | 'ATTEMPT_RECORDED'
  | 'LAUNCH_SUCCEEDED'
  | 'LAUNCH_FAILED';

export type ScheduleLaunchEvent = {
  sequence: number;
  scheduleId: string;
  missionId: string;
  slotId: string;
  eventType: ScheduleLaunchEventType;
  recordedAtUtc: string;
  dueDecision: DueDecision;
  runId?: string;
  launchError?: string;
};

export type ScheduleLaunchRecord = {
  scheduleId: string;
  missionId: string;
  slotId: string;
  dueDecision: DueDecision;
  launched: boolean;
  runId?: string;
  launchError?: string;
  attemptedAtUtc: string;
  completedAtUtc?: string;
};

export type SchedulerTickResult = {
  tickTimeUtc: string;
  evaluations: ScheduleEvaluation[];
  launches: ScheduleLaunchRecord[];
};

export type ScheduleInspection = {
  scheduleId: string;
  missionId: string | null;
  enabled: boolean;
  cadenceDescription: string;
  currentDueDecision: DueDecision;
  currentSlotId?: string;
  dueAtUtc?: string;
  nextDueUtc?: string;
  lastLaunchSlotId?: string;
  lastRunId?: string;
  lastLaunchError?: string;
  launchHistory: ScheduleLaunchRecord[];
};
