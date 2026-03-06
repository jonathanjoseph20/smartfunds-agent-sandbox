import fs from 'node:fs';
import path from 'node:path';

import type { AgentProfileDefinition } from './agent-profile-types.ts';
import { validateAgentProfileDefinitions } from './agent-profile-validator.ts';

const DEFAULT_AGENT_PROFILES_DIR = 'control-plane/agents/profiles';

function loadJsonFiles<T>(dir: string): Array<{ file: string; data: T }> {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const filePath = path.join(dir, entry);
      const raw = fs.readFileSync(filePath, 'utf8');
      return {
        file: entry,
        data: JSON.parse(raw) as T
      };
    });
}

export function loadAgentProfilesFromDir(dir: string = DEFAULT_AGENT_PROFILES_DIR): AgentProfileDefinition[] {
  const loaded = loadJsonFiles<unknown>(dir).map(({ data }) => data);
  return validateAgentProfileDefinitions(loaded);
}

export function loadAgentProfileById(agentId: string, dir: string = DEFAULT_AGENT_PROFILES_DIR): AgentProfileDefinition {
  const profiles = loadAgentProfilesFromDir(dir);
  const profile = profiles.find((entry) => entry.agentId === agentId);
  if (!profile) {
    throw new Error(`Agent profile not found: ${agentId}`);
  }
  return profile;
}

export function indexAgentProfilesById(profiles: AgentProfileDefinition[]): Map<string, AgentProfileDefinition> {
  return new Map(profiles.map((profile) => [profile.agentId, profile]));
}
