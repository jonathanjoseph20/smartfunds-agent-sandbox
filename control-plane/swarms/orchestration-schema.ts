export const PHASES = ['plan', 'setup', 'implement', 'verify', 'test', 'release'] as const;

export type OrchestrationPhase = (typeof PHASES)[number];

export type OrchestrationSwarmV1 = {
  swarmId: string;
  phase: OrchestrationPhase;
  dependsOn: string[];
  allowsCrossModeDeps?: boolean;
  notes?: string;
};

export type OrchestrationRegistryV1 = {
  version: 1;
  swarms: OrchestrationSwarmV1[];
};

type ParseOk = {
  ok: true;
  value: OrchestrationRegistryV1;
};

type ParseError = {
  ok: false;
  errors: string[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function phaseIndex(phase: OrchestrationPhase): number {
  return PHASES.indexOf(phase);
}

export function parseOrchestrationRegistryV1(value: unknown): ParseOk | ParseError {
  const errors: string[] = [];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      errors: ['orchestration.schema_invalid: root must be an object']
    };
  }

  const root = value as Record<string, unknown>;
  if (root.version !== 1) {
    errors.push('orchestration.schema_invalid: version must be 1');
  }

  if (!Array.isArray(root.swarms)) {
    errors.push('orchestration.schema_invalid: swarms must be an array');
  }

  const swarms: OrchestrationSwarmV1[] = [];
  if (Array.isArray(root.swarms)) {
    for (let index = 0; index < root.swarms.length; index += 1) {
      const entry = root.swarms[index];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`orchestration.schema_invalid: swarms[${index}] must be an object`);
        continue;
      }

      const record = entry as Record<string, unknown>;
      if (!isNonEmptyString(record.swarmId)) {
        errors.push(`orchestration.schema_invalid: swarms[${index}].swarmId must be a non-empty string`);
      }
      if (typeof record.phase !== 'string' || !PHASES.includes(record.phase as OrchestrationPhase)) {
        errors.push(`orchestration.schema_invalid: swarms[${index}].phase must be one of ${PHASES.join(',')}`);
      }
      if (!Array.isArray(record.dependsOn) || !record.dependsOn.every(isNonEmptyString)) {
        errors.push(`orchestration.schema_invalid: swarms[${index}].dependsOn must be an array of non-empty strings`);
      }
      if (record.allowsCrossModeDeps !== undefined && typeof record.allowsCrossModeDeps !== 'boolean') {
        errors.push(`orchestration.schema_invalid: swarms[${index}].allowsCrossModeDeps must be boolean when provided`);
      }
      if (record.notes !== undefined && typeof record.notes !== 'string') {
        errors.push(`orchestration.schema_invalid: swarms[${index}].notes must be a string when provided`);
      }

      if (
        isNonEmptyString(record.swarmId) &&
        typeof record.phase === 'string' &&
        PHASES.includes(record.phase as OrchestrationPhase) &&
        Array.isArray(record.dependsOn) &&
        record.dependsOn.every(isNonEmptyString) &&
        (record.allowsCrossModeDeps === undefined || typeof record.allowsCrossModeDeps === 'boolean') &&
        (record.notes === undefined || typeof record.notes === 'string')
      ) {
        swarms.push({
          swarmId: record.swarmId,
          phase: record.phase as OrchestrationPhase,
          dependsOn: [...record.dependsOn],
          ...(record.allowsCrossModeDeps !== undefined ? { allowsCrossModeDeps: record.allowsCrossModeDeps } : {}),
          ...(record.notes !== undefined ? { notes: record.notes } : {})
        });
      }
    }
  }

  const seen = new Set<string>();
  for (const swarm of swarms) {
    if (seen.has(swarm.swarmId)) {
      errors.push(`orchestration.schema_invalid: duplicate swarmId=${swarm.swarmId}`);
      continue;
    }
    seen.add(swarm.swarmId);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors: sortedUnique(errors)
    };
  }

  const normalized: OrchestrationRegistryV1 = {
    version: 1,
    swarms: [...swarms].sort((a, b) => a.swarmId.localeCompare(b.swarmId))
  };

  return {
    ok: true,
    value: normalized
  };
}
