import type { Mission, WorkflowRun, WorkflowNode, TraceEvent, TeamRoster, WorkflowDefinition, FailureDetails } from './types';

// --- Agents & Teams ---
export const teamRosters: TeamRoster[] = [
  {
    teamId: 'smartfunds-research-team',
    agents: [
      { agentId: 'agent-market-analyst', role: 'market-analyst', profile: 'Analyzes market trends and identifies opportunities in tokenized assets.' },
      { agentId: 'agent-risk-assessor', role: 'risk-assessor', profile: 'Evaluates risk exposure across asset classes and generates risk scores.' },
      { agentId: 'agent-data-collector', role: 'data-collector', profile: 'Collects and normalizes on-chain and off-chain data feeds.' },
      { agentId: 'agent-report-writer', role: 'report-writer', profile: 'Synthesizes analysis into structured operator-ready reports.' },
    ],
  },
  {
    teamId: 'smartfunds-execution-team',
    agents: [
      { agentId: 'agent-trade-executor', role: 'trade-executor', profile: 'Executes trades based on approved strategies within safety limits.' },
      { agentId: 'agent-compliance-checker', role: 'compliance-checker', profile: 'Validates trade parameters against compliance rules before execution.' },
    ],
  },
];

// --- Workflow Nodes ---
const healthyNodes: WorkflowNode[] = [
  { nodeId: 'node-collect', label: 'Data Collection', status: 'completed', dependsOn: [], agentId: 'agent-data-collector', adapterId: 'adapter-chaindata', inputs: { sources: ['coingecko', 'defillama', 'rwa.xyz'] }, previousOutputs: {}, outputs: { dataPoints: 1842, lastBlock: 19234567 }, retryCount: 0, maxRetries: 3, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-analyze', label: 'Market Analysis', status: 'completed', dependsOn: ['node-collect'], agentId: 'agent-market-analyst', adapterId: 'adapter-llm', inputs: { market: 'ethereum', asset: 'tokenized-treasuries' }, previousOutputs: { dataPoints: 1842 }, outputs: { trendScore: 0.72, sentiment: 'cautiously-bullish' }, retryCount: 0, maxRetries: 3, timeoutMs: 60000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-risk', label: 'Risk Assessment', status: 'completed', dependsOn: ['node-analyze'], agentId: 'agent-risk-assessor', adapterId: 'adapter-risk-engine', inputs: { riskLevel: 'medium', horizon: '30d' }, previousOutputs: { trendScore: 0.72 }, outputs: { riskScore: 0.34, recommendation: 'proceed-with-caution' }, retryCount: 0, maxRetries: 3, timeoutMs: 45000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-report', label: 'Report Generation', status: 'completed', dependsOn: ['node-risk'], agentId: 'agent-report-writer', adapterId: 'adapter-doc-gen', inputs: { format: 'structured-json' }, previousOutputs: { riskScore: 0.34, recommendation: 'proceed-with-caution' }, outputs: { reportId: 'rpt-20260305-eth-tt', sections: 4 }, retryCount: 0, maxRetries: 2, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'none' },
];

const failedNodes: WorkflowNode[] = [
  { nodeId: 'node-collect-f', label: 'Data Collection', status: 'completed', dependsOn: [], agentId: 'agent-data-collector', adapterId: 'adapter-chaindata', inputs: { sources: ['coingecko', 'defillama'] }, previousOutputs: {}, outputs: { dataPoints: 923 }, retryCount: 0, maxRetries: 3, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-analyze-f', label: 'Market Analysis', status: 'failed', dependsOn: ['node-collect-f'], agentId: 'agent-market-analyst', adapterId: 'adapter-llm', inputs: { market: 'solana', asset: 'depin-tokens' }, previousOutputs: { dataPoints: 923 }, outputs: {}, retryCount: 3, maxRetries: 3, timeoutMs: 60000, timeoutState: 'triggered', recoveryState: 'failed',
    failureDetails: { code: 'ADAPTER_TIMEOUT', message: 'LLM adapter timed out after 3 retry attempts. Last attempt exceeded 60s safety limit.', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', adapterId: 'adapter-llm', retryExhausted: true, timeoutClassification: 'hard-timeout', safetyViolation: false, recoverySummary: 'Recovery attempted via fallback prompt. Recovery also timed out.', suggestedAction: 'Check LLM adapter health. Consider increasing timeout or switching adapter.', cliCommand: 'workflow:retry --run run-002 --node node-analyze-f', slackCommand: '/smartfunds workflow:retry --run run-002 --node node-analyze-f' } },
  { nodeId: 'node-risk-f', label: 'Risk Assessment', status: 'pending', dependsOn: ['node-analyze-f'], agentId: 'agent-risk-assessor', adapterId: 'adapter-risk-engine', inputs: {}, previousOutputs: {}, outputs: {}, retryCount: 0, maxRetries: 3, timeoutMs: 45000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-report-f', label: 'Report Generation', status: 'pending', dependsOn: ['node-risk-f'], agentId: 'agent-report-writer', adapterId: 'adapter-doc-gen', inputs: {}, previousOutputs: {}, outputs: {}, retryCount: 0, maxRetries: 2, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'none' },
];

const cancelledNodes: WorkflowNode[] = [
  { nodeId: 'node-collect-c', label: 'Data Collection', status: 'completed', dependsOn: [], agentId: 'agent-data-collector', adapterId: 'adapter-chaindata', inputs: { sources: ['coingecko'] }, previousOutputs: {}, outputs: { dataPoints: 412 }, retryCount: 0, maxRetries: 3, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-analyze-c', label: 'Market Analysis', status: 'cancelled', dependsOn: ['node-collect-c'], agentId: 'agent-market-analyst', adapterId: 'adapter-llm', inputs: { market: 'avalanche', asset: 'rwa-stablecoins' }, previousOutputs: { dataPoints: 412 }, outputs: {}, retryCount: 0, maxRetries: 3, timeoutMs: 60000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-risk-c', label: 'Risk Assessment', status: 'skipped', dependsOn: ['node-analyze-c'], agentId: 'agent-risk-assessor', adapterId: 'adapter-risk-engine', inputs: {}, previousOutputs: {}, outputs: {}, retryCount: 0, maxRetries: 3, timeoutMs: 45000, timeoutState: 'none', recoveryState: 'none' },
];

const recoveredNodes: WorkflowNode[] = [
  { nodeId: 'node-collect-r', label: 'Data Collection', status: 'completed', dependsOn: [], agentId: 'agent-data-collector', adapterId: 'adapter-chaindata', inputs: { sources: ['coingecko', 'defillama', 'dune'] }, previousOutputs: {}, outputs: { dataPoints: 2105 }, retryCount: 1, maxRetries: 3, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'completed' },
  { nodeId: 'node-analyze-r', label: 'Market Analysis', status: 'completed', dependsOn: ['node-collect-r'], agentId: 'agent-market-analyst', adapterId: 'adapter-llm', inputs: { market: 'polygon', asset: 'tokenized-bonds' }, previousOutputs: { dataPoints: 2105 }, outputs: { trendScore: 0.58, sentiment: 'neutral' }, retryCount: 2, maxRetries: 3, timeoutMs: 60000, timeoutState: 'none', recoveryState: 'completed' },
  { nodeId: 'node-risk-r', label: 'Risk Assessment', status: 'completed', dependsOn: ['node-analyze-r'], agentId: 'agent-risk-assessor', adapterId: 'adapter-risk-engine', inputs: { riskLevel: 'high', horizon: '7d' }, previousOutputs: { trendScore: 0.58 }, outputs: { riskScore: 0.67, recommendation: 'hold' }, retryCount: 0, maxRetries: 3, timeoutMs: 45000, timeoutState: 'none', recoveryState: 'none' },
  { nodeId: 'node-report-r', label: 'Report Generation', status: 'completed', dependsOn: ['node-risk-r'], agentId: 'agent-report-writer', adapterId: 'adapter-doc-gen', inputs: { format: 'structured-json' }, previousOutputs: { riskScore: 0.67 }, outputs: { reportId: 'rpt-20260304-poly-tb', sections: 3 }, retryCount: 0, maxRetries: 2, timeoutMs: 30000, timeoutState: 'none', recoveryState: 'none' },
];

// --- Missions ---
export const missions: Mission[] = [
  { missionId: 'rwa-market-analysis', status: 'running', teamId: 'smartfunds-research-team', workflowId: 'research-analysis-workflow', parameters: [{ key: 'market', value: 'ethereum' }, { key: 'asset', value: 'tokenized-treasuries' }, { key: 'horizon', value: '30d' }, { key: 'risk-level', value: 'medium' }], workflowRuns: ['run-001'], startedAt: '2026-03-05T08:00:00Z' },
  { missionId: 'depin-analysis', status: 'failed', teamId: 'smartfunds-research-team', workflowId: 'research-analysis-workflow', parameters: [{ key: 'market', value: 'solana' }, { key: 'asset', value: 'depin-tokens' }, { key: 'horizon', value: '14d' }, { key: 'risk-level', value: 'high' }], workflowRuns: ['run-002'], startedAt: '2026-03-04T14:30:00Z' },
  { missionId: 'avax-stablecoin-review', status: 'cancelled', teamId: 'smartfunds-research-team', workflowId: 'research-analysis-workflow', parameters: [{ key: 'market', value: 'avalanche' }, { key: 'asset', value: 'rwa-stablecoins' }, { key: 'horizon', value: '7d' }, { key: 'risk-level', value: 'low' }], workflowRuns: ['run-003'], startedAt: '2026-03-03T10:00:00Z', completedAt: '2026-03-03T10:15:00Z' },
  { missionId: 'polygon-bond-assessment', status: 'completed', teamId: 'smartfunds-research-team', workflowId: 'research-analysis-workflow', parameters: [{ key: 'market', value: 'polygon' }, { key: 'asset', value: 'tokenized-bonds' }, { key: 'horizon', value: '7d' }, { key: 'risk-level', value: 'high' }], workflowRuns: ['run-004'], startedAt: '2026-03-02T09:00:00Z', completedAt: '2026-03-02T16:45:00Z' },
  { missionId: 'eth-treasury-deep-dive', status: 'completed', teamId: 'smartfunds-research-team', workflowId: 'research-analysis-workflow', parameters: [{ key: 'market', value: 'ethereum' }, { key: 'asset', value: 'tokenized-treasuries' }, { key: 'horizon', value: '90d' }, { key: 'risk-level', value: 'low' }], workflowRuns: ['run-005'], startedAt: '2026-02-28T08:00:00Z', completedAt: '2026-03-01T12:00:00Z' },
  { missionId: 'trade-execution-alpha', status: 'created', teamId: 'smartfunds-execution-team', workflowId: 'execution-workflow', parameters: [{ key: 'strategy', value: 'momentum' }, { key: 'max-position', value: '50000' }], workflowRuns: [] },
];

// --- Runs ---
export const runs: WorkflowRun[] = [
  { runId: 'run-001', missionId: 'rwa-market-analysis', workflowId: 'research-analysis-workflow', status: 'running', nodes: healthyNodes.map(n => ({ ...n, status: n.nodeId === 'node-report' ? 'running' as const : n.status })), activeNodeId: 'node-report', failedNodeId: undefined, completedNodeCount: 3, totalNodeCount: 4, retryCount: 0, recoveryState: undefined, cancellationFlag: false, startedAt: '2026-03-05T08:01:00Z', teamId: 'smartfunds-research-team' },
  { runId: 'run-002', missionId: 'depin-analysis', workflowId: 'research-analysis-workflow', status: 'failed', nodes: failedNodes, activeNodeId: undefined, failedNodeId: 'node-analyze-f', completedNodeCount: 1, totalNodeCount: 4, retryCount: 3, recoveryState: 'failed', cancellationFlag: false, startedAt: '2026-03-04T14:31:00Z', completedAt: '2026-03-04T15:10:00Z', teamId: 'smartfunds-research-team' },
  { runId: 'run-003', missionId: 'avax-stablecoin-review', workflowId: 'research-analysis-workflow', status: 'cancelled', nodes: cancelledNodes, activeNodeId: undefined, failedNodeId: undefined, completedNodeCount: 1, totalNodeCount: 3, retryCount: 0, recoveryState: undefined, cancellationFlag: true, startedAt: '2026-03-03T10:01:00Z', completedAt: '2026-03-03T10:15:00Z', teamId: 'smartfunds-research-team' },
  { runId: 'run-004', missionId: 'polygon-bond-assessment', workflowId: 'research-analysis-workflow', status: 'recovered', nodes: recoveredNodes, activeNodeId: undefined, failedNodeId: undefined, completedNodeCount: 4, totalNodeCount: 4, retryCount: 3, recoveryState: 'completed', cancellationFlag: false, startedAt: '2026-03-02T09:01:00Z', completedAt: '2026-03-02T16:44:00Z', teamId: 'smartfunds-research-team' },
  { runId: 'run-005', missionId: 'eth-treasury-deep-dive', workflowId: 'research-analysis-workflow', status: 'completed', nodes: healthyNodes, activeNodeId: undefined, failedNodeId: undefined, completedNodeCount: 4, totalNodeCount: 4, retryCount: 0, recoveryState: undefined, cancellationFlag: false, startedAt: '2026-02-28T08:01:00Z', completedAt: '2026-03-01T11:58:00Z', teamId: 'smartfunds-research-team' },
];

// --- Trace Events ---
export const traceEvents: Record<string, TraceEvent[]> = {
  'run-001': [
    { timestamp: '2026-03-05T08:01:00Z', eventType: 'run_started', detail: 'Run started for mission rwa-market-analysis', sequence: 1 },
    { timestamp: '2026-03-05T08:01:01Z', eventType: 'node_entered', nodeId: 'node-collect', agentId: 'agent-data-collector', detail: 'Data Collection node entered', sequence: 2 },
    { timestamp: '2026-03-05T08:03:30Z', eventType: 'node_completed', nodeId: 'node-collect', agentId: 'agent-data-collector', detail: 'Collected 1842 data points', sequence: 3 },
    { timestamp: '2026-03-05T08:03:31Z', eventType: 'node_entered', nodeId: 'node-analyze', agentId: 'agent-market-analyst', detail: 'Market Analysis node entered', sequence: 4 },
    { timestamp: '2026-03-05T08:05:45Z', eventType: 'node_completed', nodeId: 'node-analyze', agentId: 'agent-market-analyst', detail: 'Analysis complete: trendScore=0.72', sequence: 5 },
    { timestamp: '2026-03-05T08:05:46Z', eventType: 'node_entered', nodeId: 'node-risk', agentId: 'agent-risk-assessor', detail: 'Risk Assessment node entered', sequence: 6 },
    { timestamp: '2026-03-05T08:07:20Z', eventType: 'node_completed', nodeId: 'node-risk', agentId: 'agent-risk-assessor', detail: 'Risk score: 0.34, recommendation: proceed-with-caution', sequence: 7 },
    { timestamp: '2026-03-05T08:07:21Z', eventType: 'node_entered', nodeId: 'node-report', agentId: 'agent-report-writer', detail: 'Report Generation node entered', sequence: 8 },
  ],
  'run-002': [
    { timestamp: '2026-03-04T14:31:00Z', eventType: 'run_started', detail: 'Run started for mission depin-analysis', sequence: 1 },
    { timestamp: '2026-03-04T14:31:01Z', eventType: 'node_entered', nodeId: 'node-collect-f', agentId: 'agent-data-collector', detail: 'Data Collection node entered', sequence: 2 },
    { timestamp: '2026-03-04T14:33:00Z', eventType: 'node_completed', nodeId: 'node-collect-f', agentId: 'agent-data-collector', detail: 'Collected 923 data points', sequence: 3 },
    { timestamp: '2026-03-04T14:33:01Z', eventType: 'node_entered', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', detail: 'Market Analysis node entered', sequence: 4 },
    { timestamp: '2026-03-04T14:34:01Z', eventType: 'timeout_triggered', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', detail: 'Node timed out after 60s', sequence: 5 },
    { timestamp: '2026-03-04T14:34:02Z', eventType: 'retry_scheduled', nodeId: 'node-analyze-f', detail: 'Retry 1/3 scheduled', sequence: 6 },
    { timestamp: '2026-03-04T14:34:05Z', eventType: 'retry_attempt', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', detail: 'Retry attempt 1 started', sequence: 7 },
    { timestamp: '2026-03-04T14:35:05Z', eventType: 'timeout_triggered', nodeId: 'node-analyze-f', detail: 'Retry 1 timed out', sequence: 8 },
    { timestamp: '2026-03-04T14:35:06Z', eventType: 'retry_scheduled', nodeId: 'node-analyze-f', detail: 'Retry 2/3 scheduled', sequence: 9 },
    { timestamp: '2026-03-04T14:35:09Z', eventType: 'retry_attempt', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', detail: 'Retry attempt 2 started', sequence: 10 },
    { timestamp: '2026-03-04T14:36:09Z', eventType: 'timeout_triggered', nodeId: 'node-analyze-f', detail: 'Retry 2 timed out', sequence: 11 },
    { timestamp: '2026-03-04T14:36:10Z', eventType: 'retry_scheduled', nodeId: 'node-analyze-f', detail: 'Retry 3/3 scheduled', sequence: 12 },
    { timestamp: '2026-03-04T14:36:13Z', eventType: 'retry_attempt', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', detail: 'Retry attempt 3 started', sequence: 13 },
    { timestamp: '2026-03-04T14:37:13Z', eventType: 'timeout_triggered', nodeId: 'node-analyze-f', detail: 'Retry 3 timed out. Retries exhausted.', sequence: 14 },
    { timestamp: '2026-03-04T14:37:14Z', eventType: 'recovery_entered', nodeId: 'node-analyze-f', detail: 'Recovery entered: fallback prompt strategy', sequence: 15 },
    { timestamp: '2026-03-04T14:38:14Z', eventType: 'recovery_completed', nodeId: 'node-analyze-f', detail: 'Recovery failed: fallback also timed out', sequence: 16 },
    { timestamp: '2026-03-04T14:38:15Z', eventType: 'node_failed', nodeId: 'node-analyze-f', agentId: 'agent-market-analyst', detail: 'Node failed: ADAPTER_TIMEOUT after 3 retries and recovery', sequence: 17 },
  ],
  'run-003': [
    { timestamp: '2026-03-03T10:01:00Z', eventType: 'run_started', detail: 'Run started for mission avax-stablecoin-review', sequence: 1 },
    { timestamp: '2026-03-03T10:01:01Z', eventType: 'node_entered', nodeId: 'node-collect-c', agentId: 'agent-data-collector', detail: 'Data Collection node entered', sequence: 2 },
    { timestamp: '2026-03-03T10:03:00Z', eventType: 'node_completed', nodeId: 'node-collect-c', agentId: 'agent-data-collector', detail: 'Collected 412 data points', sequence: 3 },
    { timestamp: '2026-03-03T10:03:01Z', eventType: 'node_entered', nodeId: 'node-analyze-c', agentId: 'agent-market-analyst', detail: 'Market Analysis node entered', sequence: 4 },
    { timestamp: '2026-03-03T10:10:00Z', eventType: 'cancellation_requested', detail: 'Operator requested mission cancellation', sequence: 5 },
    { timestamp: '2026-03-03T10:10:01Z', eventType: 'cancellation_finalized', nodeId: 'node-analyze-c', detail: 'Run cancelled. Active node terminated.', sequence: 6 },
  ],
};

// --- Workflow Definitions ---
export const workflowDefinitions: WorkflowDefinition[] = [
  { workflowId: 'research-analysis-workflow', label: 'Research & Analysis Workflow', nodes: healthyNodes },
  { workflowId: 'execution-workflow', label: 'Trade Execution Workflow', nodes: [
    { nodeId: 'node-compliance', label: 'Compliance Check', status: 'pending', dependsOn: [], agentId: 'agent-compliance-checker', adapterId: 'adapter-compliance', inputs: {}, previousOutputs: {}, outputs: {}, retryCount: 0, maxRetries: 2, timeoutMs: 15000, timeoutState: 'none', recoveryState: 'none' },
    { nodeId: 'node-execute', label: 'Trade Execution', status: 'pending', dependsOn: ['node-compliance'], agentId: 'agent-trade-executor', adapterId: 'adapter-dex', inputs: {}, previousOutputs: {}, outputs: {}, retryCount: 0, maxRetries: 1, timeoutMs: 10000, timeoutState: 'none', recoveryState: 'none' },
  ] },
];
