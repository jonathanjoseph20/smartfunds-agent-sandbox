import {
  SUPPORTED_AGENT_ADAPTERS,
  type AgentAdapterType,
  type AgentProfileDefinition
} from './agent-profile-types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!isStringArray(value)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseAdapterList(value: unknown, label: string): AgentAdapterType[] {
  const adapters = ensureStringArray(value, label);
  const invalid = adapters.filter((adapter) => !SUPPORTED_AGENT_ADAPTERS.includes(adapter as AgentAdapterType));
  if (invalid.length > 0) {
    throw new Error(`${label} contains unsupported adapters: ${sortedUnique(invalid).join(', ')}.`);
  }
  return sortedUnique(adapters) as AgentAdapterType[];
}

function assertRequiredSections(record: Record<string, unknown>, agentId: string): void {
  const requiredSections = [
    'personalityProfile',
    'skillsProfile',
    'backgroundProfile',
    'outputProfile',
    'constraintsProfile',
    'toolProfile'
  ] as const;

  for (const section of requiredSections) {
    const value = record[section];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Agent profile ${agentId} missing required section: ${section}.`);
    }
  }
}

function overlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

export function validateAgentProfileDefinition(value: unknown): AgentProfileDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Agent profile must be an object.');
  }

  const record = value as Record<string, unknown>;

  assertNonEmptyString(record.agentId, 'agentId');
  assertNonEmptyString(record.displayName, `Agent profile ${record.agentId} displayName`);
  assertNonEmptyString(record.role, `Agent profile ${record.agentId} role`);
  assertNonEmptyString(record.projectId, `Agent profile ${record.agentId} projectId`);

  if (!SUPPORTED_AGENT_ADAPTERS.includes(record.adapterType as AgentAdapterType)) {
    throw new Error(
      `Agent profile ${record.agentId} adapterType must be one of ${SUPPORTED_AGENT_ADAPTERS.join(', ')}.`
    );
  }

  assertRequiredSections(record, record.agentId);

  const personalityProfile = record.personalityProfile as Record<string, unknown>;
  const skillsProfile = record.skillsProfile as Record<string, unknown>;
  const backgroundProfile = record.backgroundProfile as Record<string, unknown>;
  const outputProfile = record.outputProfile as Record<string, unknown>;
  const constraintsProfile = record.constraintsProfile as Record<string, unknown>;
  const toolProfile = record.toolProfile as Record<string, unknown>;

  assertNonEmptyString(personalityProfile.tone, `Agent profile ${record.agentId} personalityProfile.tone`);
  assertNonEmptyString(personalityProfile.reasoningStyle, `Agent profile ${record.agentId} personalityProfile.reasoningStyle`);
  assertNonEmptyString(personalityProfile.temperament, `Agent profile ${record.agentId} personalityProfile.temperament`);
  assertNonEmptyString(personalityProfile.collaborationStyle, `Agent profile ${record.agentId} personalityProfile.collaborationStyle`);
  assertNonEmptyString(personalityProfile.communicationStyle, `Agent profile ${record.agentId} personalityProfile.communicationStyle`);

  const coreSkills = ensureStringArray(skillsProfile.coreSkills, `Agent profile ${record.agentId} skillsProfile.coreSkills`);
  const secondarySkills = skillsProfile.secondarySkills === undefined
    ? []
    : ensureStringArray(skillsProfile.secondarySkills, `Agent profile ${record.agentId} skillsProfile.secondarySkills`);
  const domains = ensureStringArray(skillsProfile.domains, `Agent profile ${record.agentId} skillsProfile.domains`);

  assertNonEmptyString(backgroundProfile.professionalArchetype, `Agent profile ${record.agentId} backgroundProfile.professionalArchetype`);
  const domainBackground = ensureStringArray(
    backgroundProfile.domainBackground,
    `Agent profile ${record.agentId} backgroundProfile.domainBackground`
  );
  const perspectiveBiases = backgroundProfile.perspectiveBiases === undefined
    ? []
    : ensureStringArray(backgroundProfile.perspectiveBiases, `Agent profile ${record.agentId} backgroundProfile.perspectiveBiases`);

  assertNonEmptyString(outputProfile.preferredFormat, `Agent profile ${record.agentId} outputProfile.preferredFormat`);
  if (outputProfile.verbosity !== 'low' && outputProfile.verbosity !== 'medium' && outputProfile.verbosity !== 'high') {
    throw new Error(`Agent profile ${record.agentId} outputProfile.verbosity must be one of low, medium, high.`);
  }
  assertNonEmptyString(outputProfile.citationStyle, `Agent profile ${record.agentId} outputProfile.citationStyle`);
  assertNonEmptyString(outputProfile.decisionStyle, `Agent profile ${record.agentId} outputProfile.decisionStyle`);

  const mustDo = ensureStringArray(constraintsProfile.mustDo, `Agent profile ${record.agentId} constraintsProfile.mustDo`);
  const mustNotDo = ensureStringArray(constraintsProfile.mustNotDo, `Agent profile ${record.agentId} constraintsProfile.mustNotDo`);

  const allowedAdapters = parseAdapterList(toolProfile.allowedAdapters, `Agent profile ${record.agentId} toolProfile.allowedAdapters`);
  const preferredTools = parseAdapterList(toolProfile.preferredTools, `Agent profile ${record.agentId} toolProfile.preferredTools`);
  const forbiddenTools = parseAdapterList(toolProfile.forbiddenTools, `Agent profile ${record.agentId} toolProfile.forbiddenTools`);

  if (!allowedAdapters.includes(record.adapterType as AgentAdapterType)) {
    throw new Error(`Agent profile ${record.agentId} adapterType must be listed in toolProfile.allowedAdapters.`);
  }

  const preferredOutsideAllowed = preferredTools.filter((tool) => !allowedAdapters.includes(tool));
  if (preferredOutsideAllowed.length > 0) {
    throw new Error(
      `Agent profile ${record.agentId} preferredTools must be a subset of allowedAdapters: ${preferredOutsideAllowed.join(', ')}.`
    );
  }

  const conflictingTools = overlap(preferredTools, forbiddenTools);
  if (conflictingTools.length > 0) {
    throw new Error(`Agent profile ${record.agentId} toolProfile conflict for: ${sortedUnique(conflictingTools).join(', ')}.`);
  }

  return {
    agentId: record.agentId,
    displayName: record.displayName,
    role: record.role,
    projectId: record.projectId,
    adapterType: record.adapterType as AgentAdapterType,
    personalityProfile: {
      tone: personalityProfile.tone,
      reasoningStyle: personalityProfile.reasoningStyle,
      temperament: personalityProfile.temperament,
      collaborationStyle: personalityProfile.collaborationStyle,
      communicationStyle: personalityProfile.communicationStyle
    },
    skillsProfile: {
      coreSkills: sortedUnique(coreSkills),
      secondarySkills: sortedUnique(secondarySkills),
      domains: sortedUnique(domains)
    },
    backgroundProfile: {
      professionalArchetype: backgroundProfile.professionalArchetype as string,
      domainBackground: sortedUnique(domainBackground),
      perspectiveBiases: sortedUnique(perspectiveBiases)
    },
    outputProfile: {
      preferredFormat: outputProfile.preferredFormat as string,
      verbosity: outputProfile.verbosity,
      citationStyle: outputProfile.citationStyle as string,
      decisionStyle: outputProfile.decisionStyle as string
    },
    constraintsProfile: {
      mustDo: sortedUnique(mustDo),
      mustNotDo: sortedUnique(mustNotDo)
    },
    toolProfile: {
      allowedAdapters,
      preferredTools,
      forbiddenTools
    },
    ...(isNonEmptyString(record.notes) ? { notes: record.notes } : {})
  };
}

export function validateAgentProfileDefinitions(profiles: unknown[]): AgentProfileDefinition[] {
  const validated = profiles.map(validateAgentProfileDefinition);
  const ids = validated.map((profile) => profile.agentId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate agentId detected: ${sortedUnique(duplicates).join(', ')}.`);
  }

  return [...validated].sort((left, right) => left.agentId.localeCompare(right.agentId));
}
