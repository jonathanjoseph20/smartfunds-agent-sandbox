import type {
  MissionTemplateDefinition,
  NormalizedTemplateParameters,
  NormalizedTemplateParameterValue,
  TemplateParameter,
  TemplateParameterType,
} from './mission-template-types.ts';

const TEMPLATE_PARAMETER_TYPES: TemplateParameterType[] = ['string', 'number', 'boolean'];
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeParameterDefinition(
  key: string,
  value: unknown,
  sourceLabel: string,
): TemplateParameter {
  if (!isPlainObject(value)) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} parameters.${key} must be an object.`);
  }

  const type = value.type;
  if (!TEMPLATE_PARAMETER_TYPES.includes(type as TemplateParameterType)) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} parameters.${key}.type must be one of string, number, boolean.`);
  }

  if (typeof value.required !== 'boolean') {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} parameters.${key}.required must be a boolean.`);
  }

  const description = asNonEmptyString(value.description);

  return {
    type: type as TemplateParameterType,
    required: value.required,
    ...(description ? { description } : {}),
  };
}

function asStringArray(value: unknown, sourceLabel: string, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  const normalized = value.map((entry) => asNonEmptyString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  return normalized as string[];
}

export function extractTemplateTokens(template: string): string[] {
  const tokens = new Set<string>();
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    tokens.add(match[1]);
  }

  return Array.from(tokens).sort((left, right) => left.localeCompare(right));
}

export function validateTemplateReferences(definition: MissionTemplateDefinition): void {
  const parameterKeys = new Set(Object.keys(definition.parameters));
  const objectiveTokens = extractTemplateTokens(definition.defaultObjectiveTemplate);

  for (const token of objectiveTokens) {
    if (!parameterKeys.has(token)) {
      throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${definition.templateId} defaultObjectiveTemplate references unknown parameter: ${token}`);
    }
  }
}

export function renderTemplateString(template: string, parameters: NormalizedTemplateParameters): string {
  return template.replace(TOKEN_PATTERN, (full: string, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(parameters, token)) {
      return full;
    }

    return String(parameters[token]);
  });
}

export function validateMissionTemplateDefinition(value: unknown, sourceLabel = '<inline>'): MissionTemplateDefinition {
  if (!isPlainObject(value)) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} template must be an object.`);
  }

  const templateId = asNonEmptyString(value.templateId);
  const missionType = asNonEmptyString(value.missionType);
  const displayName = asNonEmptyString(value.displayName);
  const description = asNonEmptyString(value.description);
  const defaultObjectiveTemplate = asNonEmptyString(value.defaultObjectiveTemplate);

  if (!templateId) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} templateId must be a non-empty string.`);
  }
  if (!missionType) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} missionType must be a non-empty string.`);
  }
  if (!displayName) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (!description) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} description must be a non-empty string.`);
  }
  if (!defaultObjectiveTemplate) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} defaultObjectiveTemplate must be a non-empty string.`);
  }

  if (!isPlainObject(value.parameters)) {
    throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} parameters must be an object.`);
  }

  const parameterEntries = Object.entries(value.parameters)
    .sort(([left], [right]) => left.localeCompare(right));

  const normalizedParameters: Record<string, TemplateParameter> = {};
  for (const [parameterName, parameterDefinition] of parameterEntries) {
    if (asNonEmptyString(parameterName) === null) {
      throw new Error(`MISSION_TEMPLATE_INVALID_SCHEMA: ${sourceLabel} parameters keys must be non-empty strings.`);
    }

    normalizedParameters[parameterName] = normalizeParameterDefinition(parameterName, parameterDefinition, sourceLabel);
  }

  const definition: MissionTemplateDefinition = {
    templateId,
    missionType,
    displayName,
    description,
    parameters: normalizedParameters,
    defaultObjectiveTemplate,
    defaultDeliverablesTemplate: asStringArray(value.defaultDeliverablesTemplate, sourceLabel, 'defaultDeliverablesTemplate'),
    allowedSourceKinds: asStringArray(value.allowedSourceKinds, sourceLabel, 'allowedSourceKinds'),
    ...(value.recommendedTeams === undefined
      ? {}
      : { recommendedTeams: asStringArray(value.recommendedTeams, sourceLabel, 'recommendedTeams') }),
    ...(value.tags === undefined ? {} : { tags: asStringArray(value.tags, sourceLabel, 'tags') }),
  };

  validateTemplateReferences(definition);

  return definition;
}

function assertTemplateParameterType(name: string, expectedType: TemplateParameterType, value: unknown): NormalizedTemplateParameterValue {
  if (expectedType === 'string') {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error(`Invalid template parameter type for ${name}: expected string`);
  }

  if (expectedType === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    throw new Error(`Invalid template parameter type for ${name}: expected number`);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  throw new Error(`Invalid template parameter type for ${name}: expected boolean`);
}

export function validateMissionTemplateParameters(
  template: MissionTemplateDefinition,
  parameters: Record<string, unknown>,
): NormalizedTemplateParameters {
  if (!isPlainObject(parameters)) {
    throw new Error('Template parameters must be an object.');
  }

  const templateParameterNames = Object.keys(template.parameters);
  const providedParameterNames = Object.keys(parameters).sort((left, right) => left.localeCompare(right));

  for (const providedName of providedParameterNames) {
    if (!Object.prototype.hasOwnProperty.call(template.parameters, providedName)) {
      throw new Error(`Unknown template parameter: ${providedName}`);
    }
  }

  for (const parameterName of templateParameterNames) {
    const definition = template.parameters[parameterName];
    if (definition.required && !Object.prototype.hasOwnProperty.call(parameters, parameterName)) {
      throw new Error(`Missing required template parameter: ${parameterName}`);
    }
  }

  const normalized: NormalizedTemplateParameters = {};

  for (const parameterName of providedParameterNames) {
    const definition = template.parameters[parameterName];
    normalized[parameterName] = assertTemplateParameterType(parameterName, definition.type, parameters[parameterName]);
  }

  return normalized;
}
