# RWA Market Analysis Mission Demo Run

This document records a successful end-to-end mission execution.

## Mission

rwa-market-analysis-live

## Run ID

run_smartfunds-core_0001

## Host

VPS (Openclaw server)

## Commands Executed

npm run mission:run -- --mission rwa-market-analysis-live

npm run workflow:runs

npm run workflow:run-inspect -- --run run_smartfunds-core_0001

## Result

Status: completed

Nodes executed: 6

Failures: 0

Timeouts: 0

Retries: 0

## Workflow Nodes

1. validate-project-context
2. load-run-context
3. execute-work-unit
4. verify-phase-output
5. run-phase-checks
6. finalize-run

## Artifacts

No artifacts generated during this run.

The mission executed a repository scan and workflow validation.

## Journal Files Created

runtime-data/journal/runs/run_smartfunds-core_0001.json

runtime-data/journal/events/run_smartfunds-core_0001.json

## Summary

This run proves the control plane, workflow engine, and mission runner
execute successfully on the VPS environment.
