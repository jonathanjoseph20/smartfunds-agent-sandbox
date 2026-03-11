import { describe, expect, it } from 'vitest';

import { createSwarmAttachment } from './swarm-attachment.ts';
import { createSwarmRegistry } from './swarm-registry.ts';

describe('swarm attachment', () => {
  it('T-SW-A1 resolves swarms for a team deterministically', () => {
    const registry = createSwarmRegistry();
    const attachment = createSwarmAttachment({ registry });

    const swarms = attachment.getSwarmsForTeam('defi-risk-team');
    expect(swarms.map((entry) => entry.swarmId)).toEqual(['protocol-risk-response']);
  });

  it('T-SW-A2 resolves team for swarm', () => {
    const attachment = createSwarmAttachment();
    expect(attachment.getSwarmTeam('governance-anomaly-response')).toBe('governance-monitoring-team');
  });
});
