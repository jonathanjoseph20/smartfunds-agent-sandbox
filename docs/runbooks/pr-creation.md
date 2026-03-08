# PR Creation (Blessed Path)

This runbook defines the single deterministic PR creation path. PR governance reads the PR **body**, not comments.

## Steps (copy/paste)

1. Generate (optional)

```bash
npm run governance:generate -- --tier 3 --out .pr-body.md
```

2. Normalize

```bash
npm run governance:normalize -- .pr-body.md
```

3. Preflight

```bash
npm run governance:preflight
```

4. Local PR body check

```bash
npm run pr:body:check
```

5. Create PR from `.pr-body.md` (blessed)

```bash
npm run pr:create -- --title "chore: <short summary>"
```

6. Verify PR body on GitHub

```bash
npm run pr:verify
```

7. If metadata was edited after a failure, refresh payload

```bash
npm run pr:refresh-metadata
```

## Notes

- The PR body must contain exactly one unfenced line `tier-0`..`tier-3`.
- The evidence block must open with a line that is exactly ` ```evidence` and close with a line that is exactly ` ``` `.
- `gh pr view --json body --jq .body` is the canonical source for verification.
- `npm run pr:create` refuses to proceed if `.pr-body.md` is missing or empty.

For automated label bootstrap/apply and the deterministic sprint helper, see `docs/runbooks/pr-governance-automation.md`.
