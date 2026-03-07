# Operator Web Dashboard — Usage Guide

## Overview

The Operator Cockpit is a read-only visualization dashboard for the SmartFunds Agent OS. It provides real-time inspection of missions, workflow runs, DAG state, node diagnostics, traces, retries, failures, timeouts, and recovery state.

**Control happens in CLI and Slack. The dashboard is for inspection only.**

## Pages

### `/cockpit` — Overview

Summary cards showing active missions, active runs, failed runs, and total missions. Quick links to Missions and Runs dashboards. Recent failures listed with links to run details.

### `/cockpit/missions` — Missions Dashboard

Table of all missions sorted by status (active → failed → completed → cancelled). Shows mission ID, status, team, workflow, latest run, start time, and parameter summary.

### `/cockpit/missions/:missionId` — Mission Detail

Full mission inspection including:
- Mission metadata (team, workflow, timestamps)
- Mission parameters (key-value table)
- Associated workflow runs with status
- Assigned agent roster with roles and profiles
- CLI/Slack command hints for `mission:inspect`, `mission:agents`, `mission:cancel`

### `/cockpit/runs` — Runs Dashboard

Table of all workflow runs sorted by status. Shows run ID, status, mission, node progress, active/failed nodes, retry count, recovery state, and duration.

### `/cockpit/runs/:runId` — Run Detail (Main Debugging Page)

Comprehensive operator debugging view:
- Run summary with mission/workflow/team links
- Runtime hardening summary (nodes, retries, recovery, cancellation)
- Failure diagnostics panel (if applicable) with failure code, message, retry exhaustion, timeout classification, safety violation, recovery summary, suggested action
- Interactive node list — click to expand node detail panel showing inputs, outputs, agent, adapter, retry/timeout/recovery state
- Full execution trace timeline in deterministic sequence order
- CLI/Slack command hints for retry, resume, cancel

### `/cockpit/workflows/:workflowId` — Workflow DAG

Visual DAG representation with:
- Nodes in canonical order with dependency edges
- Execution state per node (when viewing with `?run=<runId>`)
- Agent assignment, retry counts, timeout/recovery markers
- Click any node to expand detail panel

## Interpreting Status States

| Status | Meaning |
|--------|---------|
| `created` | Initialized, not yet started |
| `running` | Currently executing |
| `completed` | Successfully finished |
| `failed` | Failed after exhausting retries/recovery |
| `cancelled` | Operator-cancelled |
| `retrying` | Retry in progress |
| `timed_out` | Exceeded timeout limit |
| `recovering` | Recovery logic in progress |
| `recovered` | Successfully recovered from failure |

## Using CLI/Slack from Dashboard Insights

The dashboard shows command hints inline. Copy and execute them in your terminal or Slack:

```
# Retry a failed node
workflow:retry --run run-002 --node node-analyze-f

# Resume a paused run
workflow:resume --run run-002

# Cancel a mission
mission:cancel rwa-market-analysis

# Inspect a mission
mission:inspect rwa-market-analysis
```
