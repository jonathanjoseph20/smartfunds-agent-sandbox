# Research Missions Datasets Runbook (Sprint 79)

## Overview

Sprint 79 enables deterministic structured dataset generation for research missions.
Expected artifacts:

- `outreach_targets.xlsx`
- `crypto_sources.csv`
- `collateral_candidates.csv`

## Recommended Deterministic Pipeline

1. `tool.web_search`
2. `tool.page_fetch` or `tool.browser_fetch`
3. `tool.reader_extract` / `tool.table_extract` / `tool.pdf_extract`
4. `tool.company_extract` + `tool.contact_extract` + `tool.email_extract`
5. `tool.url_normalize` + `tool.domain_classify`
6. `tool.list_rank` + `tool.commodity_data`
7. `output.write_csv` / `output.write_xlsx`

## Outreach Workbook

`outreach_targets.xlsx` sheets (deterministic order using `order`):

1. `companies`
2. `contacts`
3. `sources`

Minimum column targets:

- companies: `organization`, `minerals`, `location`, `project_stage`, `website`, `description`, `source`
- contacts: `organization`, `principal`, `email`, `role`, `linkedin`, `source`
- sources: `source`, `domain`, `domain_type`, `normalized_url`

## Crypto Sources CSV

`crypto_sources.csv` columns:

- `source`
- `category`
- `credibility`
- `coverage`
- `domain_type`

`credibility` and `coverage` are deterministic numeric heuristics.
Ranking uses stable score ordering with lexical tie-breakers.

## Collateral Candidates CSV

`collateral_candidates.csv` columns:

- `commodity`
- `price`
- `daily_volume`
- `market_liquidity`
- `volatility`
- `collateral_score`

`collateral_score` formula:

`0.5 * market_liquidity + 0.3 * daily_volume - 0.2 * volatility`

## Test and CI Notes

- Unit tests mock network/browser/parser/model dependencies.
- Integration tests are hermetic and deterministic.
- Use substring filters for integration targeting where needed (e.g. `integration`) rather than shell glob positional assumptions.
