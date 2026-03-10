# PR Creation (Blessed Path)

This runbook defines the deterministic PR creation path. Governance routing reads optional profile metadata from the PR body and always reconciles it against changed-file scope.

## Steps (copy/paste)

1. Preflight

```bash
npm run governance:preflight
```

2. Optional local PR body check

```bash
npm run pr:body:check
```

3. Create PR from `.pr-body.md` (blessed)

```bash
npm run pr:create -- --title "chore: <short summary>"
```

4. Verify PR body on GitHub

```bash
npm run pr:verify
```

5. If metadata was edited after a failure, refresh payload

```bash
npm run pr:refresh-metadata
```

## Notes

- `profile: lite|build|core` is optional PR metadata.
- Legacy tier/evidence content is tolerated but ignored by governance enforcement.
- `gh pr view --json body --jq .body` is the canonical source for verification.
- `npm run pr:create` refuses to proceed if `.pr-body.md` is missing or empty.

For automated label bootstrap/apply and the deterministic sprint helper, see `docs/runbooks/pr-governance-automation.md`.
