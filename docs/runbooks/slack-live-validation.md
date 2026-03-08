# Slack Live Validation

Use existing slash commands with live mission IDs.

## Start

```text
/mission start rwa-market-analysis-live --live true --query rwa tokenization
```

## Inspect

```text
/mission inspect rwa-market-analysis-live
```

## Retry

```text
/workflow retry --run <runId> --node <nodeId>
```

## Validation Checklist

- Slack command routes through operator command router
- Runtime API returns mission/workflow payload
- Workflow trace includes node task IDs (`web_search`, `web_fetch`, `twitter_search`, `llm_synthesis`)
- Node outputs are present in journal/trace payloads
