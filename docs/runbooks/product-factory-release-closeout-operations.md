# Product Factory Release Closeout Operations

## Scope

This runbook covers PF-9 deterministic release closeout operations.

## Create Release Acceptance Record

```bash
npm run product-factory:release-create -- --track <releaseTrack> --intent <chargeIntentId>
```

Optional docs presence input:

```bash
npm run product-factory:release-create -- --track <releaseTrack> --intent <chargeIntentId> --docs <doc1,doc2>
```

## Validate Release Acceptance

```bash
npm run product-factory:release-validate -- --release <productFactoryReleaseAcceptanceRecordId>
```

Optional docs presence input:

```bash
npm run product-factory:release-validate -- --release <productFactoryReleaseAcceptanceRecordId> --docs <doc1,doc2>
```

## Inspect Release Acceptance

```bash
npm run product-factory:release-inspect -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Inspect Lifecycle Acceptance

```bash
npm run product-factory:release-lifecycle -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Inspect Replay Validation

```bash
npm run product-factory:release-replay -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Inspect Docs Completeness

```bash
npm run product-factory:release-docs -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Inspect Release Hardening

```bash
npm run product-factory:release-hardening -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Inspect Status

```bash
npm run product-factory:release-status -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Inspect History

```bash
npm run product-factory:release-history -- --release <productFactoryReleaseAcceptanceRecordId>
```

## Materialize Release Artifacts

```bash
npm run product-factory:release-materialize -- --release <productFactoryReleaseAcceptanceRecordId>
```

Outputs:

`artifacts/product-factory-release/<releaseId>/`

Files:

- `product-factory-release-status.json`
- `product-factory-lifecycle-acceptance.json`
- `product-factory-replay-validation.json`
- `product-factory-docs-completeness.json`
- `product-factory-release-hardening.json`
- `product-factory-release-history.json`
- `product-factory-release-outcome.json`
- `product-factory-release-report.json`
- `product-factory-release-report.md`

## Close Release

```bash
npm run product-factory:release-close -- --release <productFactoryReleaseAcceptanceRecordId>
```

Close is append-only and emits `product_factory_release_closed` history event.

## Troubleshooting

1. Use `product-factory:release-inspect` to review all derived acceptance summaries.
2. Use `product-factory:release-replay` to confirm deterministic replay consistency.
3. Use `product-factory:release-docs` to inspect required vs present document IDs.
4. Use `product-factory:release-history` to audit append-only release lifecycle events.
5. Re-run `product-factory:release-validate` after updating explicit docs presence input.
