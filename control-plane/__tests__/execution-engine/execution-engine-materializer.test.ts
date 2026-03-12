import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createExecutionEngineHistoryStore } from '../../execution-engine/execution-engine-history-store.ts';
import { createExecutionEngineMaterializer } from '../../execution-engine/execution-engine-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-engine-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution engine materializer', () => {
  it('T-MEE-M1 writes deterministic artifacts and re-materializes idempotently', () => {
    const historyStore = createExecutionEngineHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const projection = {
      projectOne: () => ({
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        executionJournalId: 'ej-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm-1',
        selectedTeamId: 'team-a',
        enginePolicyId: 'simulation-only-default',
        engineState: 'eligible_to_start',
        engineEligibilityState: 'eligible',
        runMode: 'simulation_only',
        runInputs: {
          normalizedRuntimePayload: {},
          executionTarget: 'team_runtime',
          allowedActions: [],
          prohibitedActions: [],
          capabilityFlags: {},
          engineMetadata: {},
        },
        runOutputs: {
          outputState: 'not_started',
          resultSummary: 'execution_engine_not_started',
          generatedArtifacts: [],
        },
        blockingReasons: [],
        limitations: ['execution_engine_bounded_layer_only'],
        provenanceInputs: {
          attemptState: 'pending',
          attemptLifecycleState: 'ready_for_execution',
          attemptBlockers: [],
          attemptLimitations: [],
          journalState: 'ready_for_runtime_events',
          journalEventCount: 2,
          journalBlockers: [],
          journalLimitations: [],
          runtimeEnvelopeState: 'ready_for_runtime',
          runtimeEnvelopeEligibility: 'eligible',
          runtimeEnvelopeBlockers: [],
          runtimeEnvelopeLimitations: [],
          contractState: 'ready_for_runtime_handoff',
          contractEligibilityState: 'eligible',
          contractBlockers: [],
          contractLimitations: [],
        },
        historyDigest: 'digest-1',
        historySummary: {
          totalEvents: 1,
        },
        statusPreview: {
          executionEngineRunId: 'er-1',
          engineState: 'eligible_to_start',
        },
        reportPreview: {
          executionEngineRunId: 'er-1',
          engineState: 'eligible_to_start',
        },
        artifactPaths: {
          dirPath: '',
          statusJsonPath: '',
          reportJsonPath: '',
          reportMarkdownPath: '',
          historyJsonPath: '',
          outputsJsonPath: '',
        },
      }),
    };

    const materializer = createExecutionEngineMaterializer({
      projection: projection as never,
      historyStore,
      executionEngineArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const first = materializer.materializeOne({ executionAttemptId: 'ea-1' });
    const second = materializer.materializeOne({ executionAttemptId: 'ea-1' });

    expect(fs.existsSync(first.statusPath)).toBe(true);
    expect(fs.existsSync(first.reportPath)).toBe(true);
    expect(fs.existsSync(first.markdownPath)).toBe(true);
    expect(fs.existsSync(first.historyPath)).toBe(true);
    expect(fs.existsSync(first.outputsPath)).toBe(true);

    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      outputs: fs.readFileSync(first.outputsPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      outputs: fs.readFileSync(second.outputsPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot.markdown).toContain('# Mission Execution Engine Report');
  });
});
