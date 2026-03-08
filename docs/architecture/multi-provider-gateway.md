# Multi-Provider Gateway (Sprint 78)

## Overview
Sprint 78 introduces a runtime capability layer for low-cost, deterministic research workflows:

Mission -> web search -> page fetch -> reader extract -> LLM summarize/structure -> CSV/XLSX artifact

Control-plane determinism is preserved by stable routing resolution, canonical response hashing, stable artifact naming, and deterministic ordering in adapters and writers.

## Gateway Abstraction
`runtime/llm/gateway.ts` is the normalized entry point.

It performs:
- policy-driven provider routing
- provider adapter invocation
- output-mode normalization (`text`, `json`, `best-effort-json`)
- deterministic response hashing: `sha256(canonicalStringify(responseWithoutHash))`
- structured logging hook

Provider implementations are isolated under `runtime/llm/providers/` and only expose a stable invoke contract upward.

## Cheap-First Routing
Routing policy is externalized to:
- `control-plane/llm/policy.json`
- `control-plane/llm/models.json`

Routing precedence:
1. `providerPreference`
2. `routeHint`
3. `taskType` mapping
4. `default`

This keeps premium providers available but non-default.

## Provider Swapability
No provider is hardcoded in gateway control flow.

Provider adapters are registered by provider id, and model selection is resolved from external config.
Replacing providers is a config + adapter registration change, not a workflow refactor.

## Output Modes
- `text`: raw provider content
- `json`: strict object JSON parse (fails on invalid/non-object)
- `best-effort-json`: extracts first JSON object candidate and parses when possible

This allows strict workflows where required and tolerant parsing where practical.

## Tool Layering
`runtime/tools/` provides normalized adapters:
- `web_search`
- `page_fetch`
- `reader_extract`

Adapters are deterministic by construction:
- stable rank/ordering
- normalized whitespace/encodings
- fixed response shapes

## Output Layer
`runtime/output/` provides deterministic artifact emission:
- `ArtifactWriter` enforces declared artifacts and deterministic paths
- `csv-writer` enforces deterministic column/row ordering and newline normalization
- `xlsx-writer` emits minimal deterministic workbook zip contents with stable sheet ordering
- `source-registry` deduplicates sources and sorts lexicographically

## Runtime Hooks
`runtime/runtime-task-executor.ts` adds callable task hooks for workflow DAG nodes:
- `llm.generate`
- `tool.web_search`
- `tool.page_fetch`
- `tool.reader_extract`
- `output.write_csv`
- `output.write_xlsx`
- `output.write_artifact`

These hooks are additive and can be bound as workflow executor logic without changing core workflow DAG semantics.
