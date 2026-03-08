# Slack Mission Control Runbook

## Environment Variables

Set all three before starting Slack gateway:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`

## Start

Use existing repo script:

```bash
npm run slack:start
```

If `@slack/bolt` is not installed, gateway startup fails with:

- `SLACK_BOLT_UNAVAILABLE: install @slack/bolt to start Slack gateway`

## Commands

- `/mission run <mission-name>`
- `/mission status <mission-id>`
- `/mission list`
- `/mission logs <mission-id>`
- `/mission cancel <mission-id>`
- `/artifact <mission-id>`

## Responses

- Success responses are rendered as Block Kit payloads.
- Validation and controller failures return deterministic structured errors.

## Artifact Delivery

- Artifact lookup path: `./artifacts/<mission-id>/...`
- Supported upload formats:
  - `.csv`
  - `.xlsx`
  - `.json`
  - `.md`
  - `.markdown`

## Troubleshooting

- Missing argument errors are returned by router as `MISSING_ARGUMENT`.
- Unknown mission subcommand returns `UNKNOWN_SUBCOMMAND`.
- Mission trace lookup without a run returns `MISSION_RUN_NOT_FOUND` via controller error wrapping.
