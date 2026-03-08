# Real Missions Runbook

## Environment

Recommended live provider configuration:

```bash
export LLM_ENABLE_PROVIDER_GOOGLE=1
export GOOGLE_API_KEY=your-key
export LLM_DAILY_BUDGET_USD=3
export LLM_MONTHLY_BUDGET_USD=30
```

Default deterministic path remains available with fake provider fallback.

## Live Mission Definitions

- `rwa-market-analysis-live`
- `smartfunds-deal-diligence-live`
- `market-signal-brief-live`

These definitions live under `control-plane/missions/definitions/*.live.json`.

## Start Mission

```bash
npm run mission:run -- --mission rwa-market-analysis-live --live true --query "rwa tokenization"
```

## Inspect Mission

```bash
npm run mission:inspect -- --mission rwa-market-analysis-live
```

## Notes

- External research is tool-gated via `web_search`, `web_fetch`, `twitter_search` task IDs.
- LLM synthesis uses the gateway (`generateStructured`) via `llm_synthesis` task ID.
