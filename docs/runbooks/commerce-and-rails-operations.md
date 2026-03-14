# Commerce and Rails Operations

## Scope

This runbook covers deterministic PF-8 commerce operations.

Commerce consumes trusted build evidence and projects bounded monetization posture.

## Create Charge Intent

```bash
npm run commerce:intent-create -- --evidence <buildEvidenceBundleId>
```

Optional flags:

- `--class <monetizationClass>`
- `--amount <decimal>`
- `--currency <code>`
- `--pay-to <target>`
- `--rails <comma-separated-rail-classes>`

## List Charge Intents

```bash
npm run commerce:intent-list
```

## Inspect Charge Intent

```bash
npm run commerce:intent-inspect -- --intent <chargeIntentId>
```

## Inspect Rail Bindings

```bash
npm run commerce:rails -- --intent <chargeIntentId>
```

Interpretation:

- `primary_binding`: deterministic primary rail.
- `fallback_binding`: deterministic fallback rail.
- `manual_binding`: operator-directed bounded binding.
- `blocked_binding`: no viable binding path.

## Inspect Rail Eligibility

```bash
npm run commerce:eligibility -- --intent <chargeIntentId>
```

Interpretation:

- `eligible`: rail can execute as-is.
- `conditionally_eligible`: rail can execute with deterministic preconditions.
- `blocked`: rail cannot execute.
- `incompatible`: rail/currency semantics mismatch.
- `inconclusive`: insufficient deterministic confidence.

## Inspect Payment Receipts

```bash
npm run commerce:receipts -- --intent <chargeIntentId>
```

## Record Payment Receipt

```bash
npm run commerce:receipt-record -- --intent <chargeIntentId> --rail-binding <railBindingId> --class <receiptClass> --reference <receiptReference>
```

Optional:

- `--reasons <comma-separated-reason-tokens>`

## Inspect Settlement Logs

```bash
npm run commerce:settlement -- --intent <chargeIntentId>
```

Settlement classes:

- `settlement_pending`
- `settlement_completed`
- `settlement_failed`
- `settlement_blocked`
- `settlement_inconclusive`

## Inspect Commerce Status

```bash
npm run commerce:status -- --intent <chargeIntentId>
```

Status values:

- `draft`
- `pending`
- `fulfilled`
- `blocked`
- `failed`
- `inconclusive`

## Inspect Commerce History

```bash
npm run commerce:history -- --intent <chargeIntentId>
```

History is append-only, deduplicated by semantic identity, and replay-safe.

## Materialize Commerce Artifacts

```bash
npm run commerce:materialize -- --intent <chargeIntentId>
```

Outputs under:

`artifacts/commerce/<chargeIntentId>/`

## Troubleshooting

1. Run `commerce:intent-inspect` to inspect full projection posture.
2. Run `commerce:rails` and `commerce:eligibility` to identify rail constraints.
3. Run `commerce:receipts` and `commerce:settlement` to inspect fulfillment progression.
4. Run `commerce:history` to audit append-only lifecycle events.
5. Re-run `commerce:materialize` after any receipt updates to persist latest projection truth.
