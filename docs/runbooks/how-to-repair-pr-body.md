# How to Repair PR Body

## Symptom

- Governance Full fails on `Validate PR body contract`.
- Error indicates missing tier line and/or missing ```evidence fence.

## Why It Happens

PR body is missing required metadata format:

- one unfenced line: `tier-0|tier-1|tier-2|tier-3`
- one fenced block opening exactly ` ```evidence ` and closed with ` ``` `

## Exact Fix Commands

```bash
npm run governance:pr-body -- --pr <N> --tier tier-3
npm run pr:body:check -- --pr <N>
```

## Success Looks Like

- `npm run governance:pr-body -- --pr <N> --tier tier-3` completes without remediation errors.
- `npm run pr:body:check -- --pr <N>` prints `PR body OK. Tier: tier-3`.
- Governance Full passes `Validate PR body contract`.
