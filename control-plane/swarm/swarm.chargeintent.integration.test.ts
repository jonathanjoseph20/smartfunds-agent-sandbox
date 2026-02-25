import { beforeEach, describe, expect, it } from 'vitest';

import { registerSwarm, clearSwarmRegistryForTests } from './registry.ts';
import { clearSwarmLogForTests, getSwarmLog } from './log.ts';
import { runSwarm } from './runner.ts';
import { clearAdapterRegistryForTests, registerAdapter } from '../finance/adapters/registry.ts';
import { StripeMockAdapter } from '../finance/adapters/stripe-mock.ts';
import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { buildChargeIntentHash } from '../finance/charge-intent.ts';
import type { SwarmDefinition } from './types.ts';

beforeEach(() => {
  clearSwarmRegistryForTests();
  clearSwarmLogForTests();
  clearAdapterRegistryForTests();
});

function registerChargeIntentSwarm(mode: 'structured' | 'autonomous'): SwarmDefinition {
  const swarm: SwarmDefinition = {
    swarmId: `intent-swarm-${mode}`,
    mode,
    roles: [
      { roleId: 'builder', description: 'Builds' },
      { roleId: 'finisher', description: 'Finishes' }
    ],
    steps: [
      { stepIndex: 1, roleId: 'builder', action: 'draft' },
      { stepIndex: 2, roleId: 'finisher', action: 'emit-charge-intent' }
    ]
  };
  registerSwarm(swarm);
  return swarm;
}

describe('swarm charge intent integration', () => {
  it('executes charge intent deterministically and logs outputs', () => {
    registerAdapter(StripeMockAdapter);
    const swarm = registerChargeIntentSwarm('structured');

    const payload = {
      requestId: 'req-1',
      chargeIntentEnvelope: {
        type: 'ChargeIntent',
        adapterId: 'stripe_mock',
        intent: {
          entityId: 'alpha-entity',
          railProfileId: 'hybrid',
          amount: '100.00',
          currency: 'USD',
          counterparty: 'customer-1',
          purpose: 'subscription'
        },
        registrySnapshot: {
          entityRegistry: [
            {
              entityId: 'alpha-entity',
              legalName: 'Alpha Entity',
              projects: ['alpha-project'],
              complianceProfile: 'phase-1',
              custodyMode: 'non_custodial'
            }
          ],
          railsRegistry: {
            version: 1,
            entities: [
              {
                entityId: 'alpha-entity',
                railProfile: 'hybrid'
              }
            ]
          }
        }
      }
    };

    const result = runSwarm({ swarmId: swarm.swarmId, payload });
    const expectedRunId = sha256(canonicalStringify({ swarmId: swarm.swarmId, payload }));

    expect(result.runId).toBe(expectedRunId);
    expect(result.chargeIntentReceipt).toBeDefined();

    const receipt = result.chargeIntentReceipt as {
      intent: { determinismHash: string; intentId: string };
      result: { outcome: string; receiptRef: string };
      logEntry: { entryId: string };
    };

    const intentHash = buildChargeIntentHash({
      entityId: 'alpha-entity',
      railProfileId: 'hybrid',
      amount: '100.00',
      currency: 'USD',
      counterparty: 'customer-1',
      purpose: 'subscription'
    });

    expect(receipt.intent.determinismHash).toBe(intentHash);
    expect(receipt.logEntry.entryId).toBe(`sl_${intentHash.slice(0, 12)}_001`);

    const logEntries = getSwarmLog(result.runId);
    expect(logEntries).toHaveLength(2);
    expect(logEntries.map((entry) => entry.stepIndex)).toEqual([1, 2]);
  });

  it('rejects autonomous mode when adapter forbids it', () => {
    registerAdapter(StripeMockAdapter);
    const swarm = registerChargeIntentSwarm('autonomous');

    const payload = {
      chargeIntentEnvelope: {
        type: 'ChargeIntent',
        adapterId: 'stripe_mock',
        intent: {
          entityId: 'alpha-entity',
          railProfileId: 'hybrid',
          amount: '100.00',
          currency: 'USD',
          counterparty: 'customer-1',
          purpose: 'subscription'
        },
        registrySnapshot: {
          entityRegistry: [
            {
              entityId: 'alpha-entity',
              legalName: 'Alpha Entity',
              projects: ['alpha-project'],
              complianceProfile: 'phase-1',
              custodyMode: 'non_custodial'
            }
          ],
          railsRegistry: {
            version: 1,
            entities: [
              {
                entityId: 'alpha-entity',
                railProfile: 'hybrid'
              }
            ]
          }
        }
      }
    };

    expect(() => runSwarm({ swarmId: swarm.swarmId, payload })).toThrow(/ERR_ADAPTER_MODE_FORBIDDEN/);
  });
});
