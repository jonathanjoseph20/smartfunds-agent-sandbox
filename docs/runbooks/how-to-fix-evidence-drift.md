# How to Fix Evidence Drift

## Symptom

- Governance Full fails on `Assert evidence idempotent`.
- CI prints: `Evidence drift detected — canonical evidence must be committed...`.

## Why It Happens

`governance/evidence.json` is not canonical for current PR metadata. CI regenerates evidence and sees a diff.

## Exact Fix Commands

```bash
npm run governance:emit:ci -- --pr <N>
git add governance/evidence.json
git commit -m "fix(governance): canonicalize evidence"
git push
```

Local CI parity check:

```bash
bash scripts/governance/emit-ci-parity.sh <N>
```

## Success Looks Like

- `bash scripts/governance/emit-ci-parity.sh <N>` prints:
  - `Evidence SHA: <sha>`
  - `✅ Evidence is already canonical. No changes.`
- Governance Full passes `Generate canonical evidence (CI)` and `Assert evidence idempotent`.
