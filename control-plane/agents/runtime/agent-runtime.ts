import { loadAgentProfilesFromDir } from '../agent-profile-loader.ts';
import type { AgentProfileDefinition } from '../agent-profile-types.ts';
import type { ExecutionContext } from '../../execution/context-types.ts';
import { buildAgentExecutionEnvelope, type AgentExecutionEnvelope } from './agent-envelope.ts';

export type AgentRuntimeInfo = {
  teamId?: string;
  activeAgent: string;
  agentEnvelope: AgentExecutionEnvelope;
  agentRoster: AgentExecutionEnvelope[];
};

type ResolveAgentProfileInput = {
  agentId: string;
  profiles?: AgentProfileDefinition[];
  agentsDir?: string;
};

type ResolveTaskAgentInput = {
  taskAgent: string;
  executionContext: ExecutionContext;
  profiles?: AgentProfileDefinition[];
  agentsDir?: string;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseErrorCode(message: string): string {
  const prefix = message.match(/^(ERR_[A-Z0-9_]+):/);
  return prefix ? prefix[1] : 'ERR_AGENT_RUNTIME_INVALID';
}

function extractRosterFromMetadata(context: ExecutionContext): string[] {
  const roster = context.metadata.agentRoster;
  if (!Array.isArray(roster)) {
    return [];
  }

  const ids = roster.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return sortedUnique(ids);
}

function resolveTeamId(context: ExecutionContext): string | undefined {
  if (context.teamId) {
    return context.teamId;
  }

  const metadataTeamId = context.metadata.teamId;
  if (typeof metadataTeamId === 'string' && metadataTeamId.trim().length > 0) {
    return metadataTeamId;
  }

  return undefined;
}

function profileIndex(profiles: AgentProfileDefinition[]): Map<string, AgentProfileDefinition> {
  return new Map(profiles.map((profile) => [profile.agentId, profile]));
}

function getProfiles(input: { profiles?: AgentProfileDefinition[]; agentsDir?: string }): AgentProfileDefinition[] {
  return input.profiles ?? loadAgentProfilesFromDir(input.agentsDir);
}

export function resolveAgentProfile(input: ResolveAgentProfileInput): AgentProfileDefinition {
  const profiles = getProfiles(input);
  const profile = profiles.find((entry) => entry.agentId === input.agentId);
  if (!profile) {
    throw new Error(`ERR_AGENT_NOT_FOUND: Agent profile not found: ${input.agentId}`);
  }
  return profile;
}

export function resolveMissionAgentRoster(
  context: ExecutionContext,
  profiles: AgentProfileDefinition[]
): AgentExecutionEnvelope[] {
  const rosterIds = extractRosterFromMetadata(context);
  if (rosterIds.length === 0) {
    return [];
  }

  const indexed = profileIndex(profiles);
  return rosterIds.map((agentId) => {
    const profile = indexed.get(agentId);
    if (!profile) {
      throw new Error(`ERR_AGENT_NOT_FOUND: Agent profile not found: ${agentId}`);
    }
    return buildAgentExecutionEnvelope(profile);
  });
}

export function buildAgentRuntime(input: ResolveTaskAgentInput): AgentRuntimeInfo {
  const profiles = getProfiles(input);
  const roster = resolveMissionAgentRoster(input.executionContext, profiles);
  const rosterIds = roster.map((entry) => entry.agentId);

  if (rosterIds.length > 0) {
    const matching = rosterIds.filter((agentId) => agentId === input.taskAgent);
    if (matching.length > 1) {
      throw new Error(`ERR_TASK_AGENT_AMBIGUOUS: Agent resolution is ambiguous for ${input.taskAgent}`);
    }
    if (matching.length === 0) {
      throw new Error(
        `ERR_TASK_AGENT_UNRESOLVED: Agent ${input.taskAgent} is not part of the mission roster`
      );
    }
  }

  const envelope = buildAgentExecutionEnvelope(resolveAgentProfile({
    agentId: input.taskAgent,
    profiles
  }));

  const agentRoster = roster.length > 0
    ? roster
    : [envelope];

  return {
    teamId: resolveTeamId(input.executionContext),
    activeAgent: envelope.agentId,
    agentEnvelope: envelope,
    agentRoster
  };
}

export function resolveTaskAgent(input: ResolveTaskAgentInput): AgentRuntimeInfo {
  if (typeof input.taskAgent !== 'string' || input.taskAgent.trim().length === 0) {
    throw new Error('ERR_TASK_AGENT_UNRESOLVED: task.agent must be a non-empty string');
  }

  try {
    return buildAgentRuntime(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ERR_AGENT_RUNTIME_INVALID: invalid agent runtime state';
    const code = parseErrorCode(message);
    if (message.startsWith(`${code}:`)) {
      throw new Error(message);
    }
    throw new Error(`${code}: ${message}`);
  }
}
