# Execution Evidence and Governance Operations

## Scope

This runbook covers PF-7 build evidence operations.

Evidence is deterministic, projection-first, and append-only.

## Create Evidence Bundle

```bash
npm run build:evidence-create -- --run <runId>
```

## Verify Evidence Bundle

```bash
npm run build:evidence-verify -- --evidence <buildEvidenceBundleId>
```

## List Evidence Bundles

```bash
npm run build:evidence-list
```

## Inspect Evidence Bundle

```bash
npm run build:evidence-inspect -- --evidence <buildEvidenceBundleId>
```

## Inspect Artifact Verification

```bash
npm run build:evidence-artifacts -- --evidence <buildEvidenceBundleId>
```

Interpretation:

- `artifact_hash_verified`: expected and actual hash match.
- `artifact_hash_mismatch`: expected and actual hash diverge.
- `artifact_missing`: expected artifact not present.
- `artifact_unexpected`: non-declared artifact present.
- `artifact_inconclusive`: insufficient hash evidence.

## Inspect Prompt Attestation

```bash
npm run build:evidence-prompt -- --evidence <buildEvidenceBundleId>
```

Interpretation:

- `prompt_verified`: packet prompt matches evidence prompt hash.
- `prompt_mismatch`: hash mismatch.
- `prompt_missing`: packet prompt unavailable.
- `prompt_inconclusive`: not enough prompt evidence.

## Inspect Execution Plan Attestation

```bash
npm run build:evidence-plan -- --evidence <buildEvidenceBundleId>
```

Interpretation:

- `execution_plan_verified`: expected plan hash matches.
- `execution_plan_mismatch`: plan hash diverges.
- `execution_plan_partial`: partial match against available execution truth.
- `execution_plan_inconclusive`: no sufficient plan evidence.

## Inspect Governance Validation

```bash
npm run build:evidence-status -- --evidence <buildEvidenceBundleId>
```

Interpretation:

- `valid`
- `partially_valid`
- `blocked`
- `failed`
- `inconclusive`

## Inspect Evidence History

```bash
npm run build:evidence-history -- --evidence <buildEvidenceBundleId>
```

History is append-only and replay-safe.

## Materialize Evidence Artifacts

```bash
npm run build:evidence-materialize -- --evidence <buildEvidenceBundleId>
```

Outputs under:

`artifacts/build-evidence/<buildEvidenceBundleId>/`

## Troubleshooting

1. Run `build:evidence-inspect` to see full projection posture.
2. Check `build:evidence-artifacts` for missing/mismatched/unexpected artifacts.
3. Check `build:evidence-prompt` and `build:evidence-plan` for attestation divergence.
4. Use `build:evidence-history` to review append-only trust progression.
5. Re-run `build:evidence-verify` before `build:evidence-materialize`.
