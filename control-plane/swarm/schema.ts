export type SwarmMode = 'structured' | 'autonomous';
export type SwarmTaskKind = 'plan' | 'implement' | 'verify' | 'test' | 'docs';

export type SwarmTask = {
  taskId: string;
  kind: SwarmTaskKind;
  summary: string;
  ownedPathsHint: string[];
  dependsOn: string[];
};

export type SwarmPolicy = {
  maxRetries: number;
  allowedModes: SwarmMode[];
  allowCrossMode: boolean;
};

export type SwarmRun = {
  schemaVersion: 'swarm/v1';
  swarmId: string;
  mode: SwarmMode;
  teamId: string | null;
  goal: string;
  tasks: SwarmTask[];
  policy: SwarmPolicy;
};

type ValidationResult =
  | { ok: true; value: SwarmRun }
  | { ok: false; errors: string[] };

const SWARM_MODES: SwarmMode[] = ['structured', 'autonomous'];
const TASK_KINDS: SwarmTaskKind[] = ['plan', 'implement', 'verify', 'test', 'docs'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSwarmMode(value: unknown): value is SwarmMode {
  return typeof value === 'string' && SWARM_MODES.includes(value as SwarmMode);
}

function isTaskKind(value: unknown): value is SwarmTaskKind {
  return typeof value === 'string' && TASK_KINDS.includes(value as SwarmTaskKind);
}

function toTask(value: unknown, index: number, errors: string[]): SwarmTask | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`tasks[${index}] must be an object.`);
    return null;
  }

  const record = value as Record<string, unknown>;
  const taskId = record.taskId;
  const kind = record.kind;
  const summary = record.summary;
  const ownedPathsHint = record.ownedPathsHint;
  const dependsOn = record.dependsOn;

  if (!isNonEmptyString(taskId)) {
    errors.push(`tasks[${index}].taskId must be a non-empty string.`);
  }
  if (!isTaskKind(kind)) {
    errors.push(`tasks[${index}].kind must be one of: ${TASK_KINDS.join(', ')}.`);
  }
  if (!isNonEmptyString(summary)) {
    errors.push(`tasks[${index}].summary must be a non-empty string.`);
  }
  if (ownedPathsHint !== undefined && !isStringArray(ownedPathsHint)) {
    errors.push(`tasks[${index}].ownedPathsHint must be an array of strings when provided.`);
  }
  if (dependsOn !== undefined && !isStringArray(dependsOn)) {
    errors.push(`tasks[${index}].dependsOn must be an array of strings when provided.`);
  }

  if (!isNonEmptyString(taskId) || !isTaskKind(kind) || !isNonEmptyString(summary)) {
    return null;
  }
  if (ownedPathsHint !== undefined && !isStringArray(ownedPathsHint)) {
    return null;
  }
  if (dependsOn !== undefined && !isStringArray(dependsOn)) {
    return null;
  }

  return {
    taskId: taskId.trim(),
    kind,
    summary: summary.trim(),
    ownedPathsHint: ownedPathsHint ? [...ownedPathsHint] : [],
    dependsOn: dependsOn ? [...dependsOn] : []
  };
}

function toPolicy(value: unknown, errors: string[]): SwarmPolicy | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('policy must be an object.');
    return null;
  }

  const record = value as Record<string, unknown>;
  const maxRetries = record.maxRetries;
  const allowedModes = record.allowedModes;
  const allowCrossMode = record.allowCrossMode;

  if (typeof maxRetries !== 'number' || !Number.isInteger(maxRetries) || maxRetries < 0) {
    errors.push('policy.maxRetries must be a non-negative integer.');
  }
  if (!Array.isArray(allowedModes) || !allowedModes.every((mode) => isSwarmMode(mode))) {
    errors.push('policy.allowedModes must be an array containing only structured/autonomous.');
  }
  if (typeof allowCrossMode !== 'boolean') {
    errors.push('policy.allowCrossMode must be a boolean.');
  }

  if (
    typeof maxRetries !== 'number' ||
    !Number.isInteger(maxRetries) ||
    maxRetries < 0 ||
    !Array.isArray(allowedModes) ||
    !allowedModes.every((mode) => isSwarmMode(mode)) ||
    typeof allowCrossMode !== 'boolean'
  ) {
    return null;
  }

  return {
    maxRetries,
    allowedModes: [...allowedModes],
    allowCrossMode
  };
}

export function validateSwarmRun(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['SwarmRun must be an object.'] };
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = record.schemaVersion;
  const swarmId = record.swarmId;
  const mode = record.mode;
  const teamId = record.teamId;
  const goal = record.goal;
  const tasks = record.tasks;
  const policy = record.policy;

  if (schemaVersion !== 'swarm/v1') {
    errors.push('schemaVersion must be "swarm/v1".');
  }
  if (!isNonEmptyString(swarmId)) {
    errors.push('swarmId must be a non-empty string.');
  }
  if (!isSwarmMode(mode)) {
    errors.push('mode must be either structured or autonomous.');
  }
  if (!(teamId === null || teamId === undefined || typeof teamId === 'string')) {
    errors.push('teamId must be a string or null.');
  }
  if (!isNonEmptyString(goal)) {
    errors.push('goal must be a non-empty string.');
  }
  if (!Array.isArray(tasks)) {
    errors.push('tasks must be an array.');
  }

  const normalizedTasks: SwarmTask[] = Array.isArray(tasks)
    ? tasks.map((task, index) => toTask(task, index, errors)).filter((task): task is SwarmTask => task !== null)
    : [];
  const normalizedPolicy = toPolicy(policy, errors);

  if (errors.length > 0 || !isNonEmptyString(swarmId) || !isSwarmMode(mode) || !isNonEmptyString(goal) || !normalizedPolicy) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      schemaVersion: 'swarm/v1',
      swarmId: swarmId.trim(),
      mode,
      teamId: typeof teamId === 'string' ? teamId.trim() : null,
      goal: goal.trim(),
      tasks: normalizedTasks,
      policy: normalizedPolicy
    }
  };
}
