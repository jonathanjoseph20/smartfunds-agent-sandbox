# Product Spec Workflow

## Overview

PF-1 introduces deterministic ProductSpec operations through CLI commands.

All command outputs are canonical JSON.

## Create

```bash
npm run products:spec-create -- --file <spec.json>
```

Example payload:

```json
{
  "name": "Stratum Money Dashboard",
  "problem": "Users cannot inspect collateral ratios.",
  "targetUser": "Stratum ecosystem participants",
  "solution": "Transparency dashboard displaying reserves.",
  "architectureSummary": "React dashboard + API.",
  "mvpScope": "Dashboard with collateral ratios.",
  "originMissionIds": ["mission-stratum-dashboard"]
}
```

Response shape:

```json
{
  "specId": "...",
  "status": "draft"
}
```

## List

```bash
npm run products:spec-list
```

Response shape:

```json
[
  {
    "specId": "...",
    "name": "...",
    "status": "draft"
  }
]
```

## Inspect

```bash
npm run products:spec-inspect -- --spec <specId>
```

Returns deterministic projection including status and validation surface.

## Materialize

```bash
npm run products:spec-materialize -- --spec <specId>
```

Writes derived artifacts to:

- `artifacts/products/<specId>/product-spec.json`
- `artifacts/products/<specId>/product-spec-status.json`
- `artifacts/products/<specId>/product-spec-validation.json`
- `artifacts/products/<specId>/product-spec-report.md`

Materialized files are derived outputs only; projection remains authoritative.

## Validation and Status Notes

Required fields:

- `name`
- `problem`
- `targetUser`
- `solution`
- `mvpScope`
- `originMissionIds`

Status behavior:

- create path keeps valid specs at `draft`
- explicit validation advancement promotes valid specs to `validated`
