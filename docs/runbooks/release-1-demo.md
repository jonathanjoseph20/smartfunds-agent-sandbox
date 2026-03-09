# Release 1 Demo Runbook (Sprint 85)

## Scope

Use exactly one mission for demo stability:

- `rwa-market-analysis` -> `research-analysis-workflow`

Do not demo `research-web-intelligence` as the canonical path for Release 1.

Demo-relevant mission/workflow mapping:

| missionId | workflowId | demo status |
| --- | --- | --- |
| `rwa-market-analysis` | `research-analysis-workflow` | canonical |
| `research-web-intelligence` | `research-web-intelligence` | non-canonical |
| `rwa-market-analysis-live` | `research-web-intelligence` | non-canonical |

## Before You Start

1. From repo root (`.`), verify deps are installed:

```bash
npm install
```

2. Optional clean-state check:

```bash
git status -sb
```

## Canonical CLI Demo Path

1. Start mission:

```bash
npm run mission:run -- --mission rwa-market-analysis
```

Success checkpoint:
- JSON output includes `"missionId":"rwa-market-analysis"`.
- JSON output includes `"workflowId":"research-analysis-workflow"`.
- Capture `"workflowRun"` as `<runId>`.

2. Inspect workflow run:

```bash
npm run workflow:run-inspect -- --run <runId>
```

Success checkpoint:
- JSON output includes `"workflow":{"runId":"<runId>"...}`.
- `"status":"completed"` in workflow summary.

3. List artifacts from repo root:

```bash
npm run artifacts:list -- --run <runId>
```

Success checkpoint:
- Output is sorted and includes exactly:
  - `dataset.csv`
  - `report.md`
  - `research-pages.json`
  - `search-results.json`

## Slack Bonus Path (Only If Slack Gateway Is Running)

Use the same mission/run identity flow:

```text
/mission run rwa-market-analysis
/mission status <runId>
/mission artifacts <runId>
```

Success checkpoint:
- `/mission run` returns a concrete `runId`.
- `/mission status` for that `runId` returns mission status text.
- `/mission artifacts` for that `runId` returns the same canonical artifact filenames.

Failure interpretation:
- `RUN_NOT_FOUND: <runId>` means the provided run id does not exist in journal state.
- `Mission definition not found: <missionId>` means mission id mismatch.
- Do not continue demo if run id and mission id cannot be resolved consistently.

## Fallback If Slack Is Unavailable

Use CLI only:
- `mission:run`
- `workflow:run-inspect`
- `artifacts:list`

This is the required stable path.

## Web Dashboard Decision

- **Do not use web UI for Release 1 demo.**
- Reason: `control-plane/cockpit` is currently a Lovable scaffold with mock-data fallback and is not a validated, dependable live operator surface.

## Do Not Demo (Current Stability Boundary)

- Any mission other than `rwa-market-analysis` as the canonical Release 1 path.
- Dashboard-driven operational claims.
- Features requiring non-deterministic/manual recovery branches.
