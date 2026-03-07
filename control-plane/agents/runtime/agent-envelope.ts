import { canonicalStringify } from '../../finance/determinism.ts';
import { SUPPORTED_AGENT_ADAPTERS, type AgentProfileDefinition } from '../agent-profile-types.ts';

export type AgentExecutionEnvelope = {
  agentId: string;
  role?: string;
  personality: {
    tone?: string;
    reasoningStyle?: string;
    [key: string]: unknown;
  };
  skills: string[];
  background: Record<string, unknown>;
  outputStyle: Record<string, unknown>;
  constraints: {
    mustDo?: string[];
    mustNotDo?: string[];
    [key: string]: unknown;
  };
  allowedTools: string[];
};

type BuildEnvelopeInput = Pick<AgentProfileDefinition,
'agentId' | 'role' | 'personalityProfile' | 'skillsProfile' | 'backgroundProfile' | 'outputProfile' | 'constraintsProfile' | 'toolProfile'>;

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const entries = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function stableClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    for (const key of Object.keys(objectValue)) {
      deepFreeze(objectValue[key]);
    }
    return Object.freeze(value);
  }

  return value;
}

function deriveSkills(profile: BuildEnvelopeInput): string[] {
  return sortedUnique([
    ...(profile.skillsProfile?.coreSkills ?? []),
    ...(profile.skillsProfile?.secondarySkills ?? []),
    ...(profile.skillsProfile?.domains ?? [])
  ]);
}

function deriveAllowedTools(profile: BuildEnvelopeInput): string[] {
  const allowlist = sortedUnique(profile.toolProfile?.allowedAdapters ?? [...SUPPORTED_AGENT_ADAPTERS]);
  const forbidden = new Set(sortedUnique(profile.toolProfile?.forbiddenTools ?? []));

  return allowlist
    .filter((adapter) => !forbidden.has(adapter))
    .sort((left, right) => left.localeCompare(right));
}

export function buildAgentExecutionEnvelope(profile: BuildEnvelopeInput): AgentExecutionEnvelope {
  const personality = sortRecord(stableClone(profile.personalityProfile ?? {}));
  const background = sortRecord(stableClone(profile.backgroundProfile ?? {}));
  const outputStyle = sortRecord(stableClone(profile.outputProfile ?? {}));
  const constraints = sortRecord(stableClone(profile.constraintsProfile ?? {}));

  const envelope: AgentExecutionEnvelope = {
    agentId: profile.agentId,
    ...(profile.role ? { role: profile.role } : {}),
    personality,
    skills: deriveSkills(profile),
    background,
    outputStyle,
    constraints,
    allowedTools: deriveAllowedTools(profile)
  };

  return deepFreeze(stableClone(envelope));
}
