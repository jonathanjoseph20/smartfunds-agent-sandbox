# Research Extraction Layer (Sprint 79)

## Purpose

Sprint 79 extends runtime tools from summarization primitives into deterministic structured extraction primitives.
The layer remains bounded inside `runtime/tools/` and is executed through existing `tool.*` runtime task types.

## Adapter Responsibilities

Adapters added in this sprint:

- `pdf_extract`: extracts `{ title, pages, text }` from PDF bytes/url with injectable parser boundary.
- `table_extract`: converts HTML tables into deterministic column/row JSON.
- `company_extract`: produces normalized `CompanyEntity[]` via extractor hook + fallback heuristics.
- `contact_extract`: produces normalized `ContactEntity[]` via extractor hook + regex/HTML fallback.
- `commodity_data`: normalizes commodity rows and computes deterministic `collateral_score`.
- `url_normalize`: canonicalizes URLs and deduplicates with tracking-param stripping.
- `domain_classify`: deterministic URL/domain heuristics for domain type classification.
- `email_extract`: `mailto` + regex extraction with stable lowercase dedupe.
- `list_rank`: deterministic ranking with explicit scoring and lexical tie-breakers.
- `browser_fetch`: thin Playwright wrapper behind injectable renderer for JS-rendered snapshots.

## Composition

Runtime pipeline remains:

Operator -> Mission -> Workflow DAG -> Runtime Task Executor -> Tool Registry -> Adapter -> Artifact Writer

No governance, PR gate, or mission orchestration contracts were changed.

## Determinism Guarantees

- Stable ordering in all list outputs.
- Lexical tie-breakers for equivalent scores.
- No randomness.
- No timestamp- or UUID-based identity fields.
- Stable hash-derived ranking identity where identity is needed.
- Reproducible XLSX output using fixed ZIP metadata and deterministic sheet/row ordering.

## Mocking and Runtime Boundaries

Unit tests mock all non-local dependencies:

- network calls via mocked `fetch`
- browser rendering via injected `renderer`
- PDF parsing via injected `pdfParser`
- extraction model behavior via injected `extractor`

`browser_fetch` can use Playwright at runtime, but tests stay hermetic and do not require browser binaries.

## Task Integration

New runtime task types are routed through existing control-plane adapter registration:

- `tool.pdf_extract`
- `tool.table_extract`
- `tool.company_extract`
- `tool.contact_extract`
- `tool.commodity_data`
- `tool.url_normalize`
- `tool.domain_classify`
- `tool.email_extract`
- `tool.list_rank`
- `tool.browser_fetch`

No special-case dispatch path was introduced.
