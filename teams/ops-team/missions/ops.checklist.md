# Ops Mission Checklist

- [ ] Confirm GitHub Actions workflow runs are green for the target branch.
- [ ] If workflow payload is stale, push an empty commit to refresh the event payload.
- [ ] Verify PR body governance fields with `gh pr view --json body --jq '.body'`.
- [ ] Verify PR labels with `gh pr view --json labels --jq '.labels[].name'`.
- [ ] Confirm runbook links and operational owners are current before handoff.
