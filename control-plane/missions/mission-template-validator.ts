import type {
  MissionArtifactDefinition,
  MissionArtifactType,
  MissionTemplateDefinition
} from './mission-control-types.ts';

const ARTIFACT_TYPES: MissionArtifactType[] = ['analysis', 'code', 'dataset', 'document', 'report'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isNonEmptyString)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return Array.from(new Set(value)).sort((left, right) => left.localeCompare(right));
}

function parseArtifacts(value: unknown, missionId: string): MissionArtifactDefinition[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Mission template ${missionId} artifacts must be a non-empty array.`);
  }

  const artifacts = value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Mission template ${missionId} artifacts[${index}] must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    assertNonEmptyString(record.name, `Mission template ${missionId} artifacts[${index}].name`);
    if (!ARTIFACT_TYPES.includes(record.type as MissionArtifactType)) {
      throw new Error(`Mission template ${missionId} artifacts[${index}].type must be one of ${ARTIFACT_TYPES.join(', ')}.`);
    }

    return {
      name: record.name,
      type: record.type as MissionArtifactType
    };
  });

  const deduped = new Map<string, MissionArtifactDefinition>();
  for (const artifact of artifacts) {
    deduped.set(artifact.name, artifact);
  }

  return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function parseAgentOverrides(value: unknown): MissionTemplateDefinition['agentOverrides'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('agentOverrides must be an object when provided.');
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([agentId, override]) => {
      if (!override || typeof override !== 'object' || Array.isArray(override)) {
        throw new Error(`agentOverrides.${agentId} must be an object.`);
      }
      const style = (override as Record<string, unknown>).style;
      return [agentId, isNonEmptyString(style) ? { style } : {}] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

function parseCustomAgents(value: unknown): MissionTemplateDefinition['customAgents'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('customAgents must be an array when provided.');
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`customAgents[${index}] must be an object.`);
      }
      const record = entry as Record<string, unknown>;
      assertNonEmptyString(record.name, `customAgents[${index}].name`);
      const skills = ensureStringArray(record.skills, `customAgents[${index}].skills`);
      return {
        name: record.name,
        skills
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function validateMissionTemplateDefinition(value: unknown): MissionTemplateDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Mission template must be an object.');
  }

  const record = value as Record<string, unknown>;

  assertNonEmptyString(record.missionId, 'missionId');
  assertNonEmptyString(record.title, `Mission template ${record.missionId} title`);
  assertNonEmptyString(record.missionType, `Mission template ${record.missionId} missionType`);
  assertNonEmptyString(record.projectId, `Mission template ${record.missionId} projectId`);
  assertNonEmptyString(record.workflowId, `Mission template ${record.missionId} workflowId`);
  assertNonEmptyString(record.teamId, `Mission template ${record.missionId} teamId`);

  const objectives = ensureStringArray(record.objectives, `Mission template ${record.missionId} objectives`);
  const successCriteria = ensureStringArray(record.successCriteria, `Mission template ${record.missionId} successCriteria`);
  const deliverables = ensureStringArray(record.deliverables, `Mission template ${record.missionId} deliverables`);
  const workflow = ensureStringArray(record.workflow, `Mission template ${record.missionId} workflow`);
  const artifacts = parseArtifacts(record.artifacts, record.missionId);

  const artifactNames = artifacts.map((artifact) => artifact.name).sort((left, right) => left.localeCompare(right));
  if (artifactNames.length !== deliverables.length || artifactNames.some((name, index) => name !== deliverables[index])) {
    throw new Error(`Mission template ${record.missionId} artifact definitions mismatch deliverables.`);
  }

  return {
    missionId: record.missionId,
    title: record.title,
    missionType: record.missionType,
    projectId: record.projectId,
    workflowId: record.workflowId,
    ...(isNonEmptyString(record.background) ? { background: record.background } : {}),
    objectives,
    successCriteria,
    deliverables,
    artifacts,
    teamId: record.teamId,
    workflow,
    ...(record.agentOverrides !== undefined ? { agentOverrides: parseAgentOverrides(record.agentOverrides) } : {}),
    ...(record.customAgents !== undefined ? { customAgents: parseCustomAgents(record.customAgents) } : {})
  };
}

export function validateMissionTemplateDefinitions(values: unknown[]): MissionTemplateDefinition[] {
  const validated = values.map(validateMissionTemplateDefinition);
  const ids = validated.map((template) => template.missionId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate mission template id: ${Array.from(new Set(duplicates)).sort((a, b) => a.localeCompare(b)).join(', ')}.`);
  }
  return [...validated].sort((left, right) => left.missionId.localeCompare(right.missionId));
}
