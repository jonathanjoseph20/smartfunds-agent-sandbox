# Slack Operations Runbook

## Prerequisites

Set environment variables:

```bash
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
export SLACK_APP_TOKEN="xapp-..."
```

Optional:

```bash
export SLACK_SOCKET_MODE="true"
```

## Start Gateway

```bash
npm run slack:start
```

Expected startup logs:

- `[Slack] Connected via Socket Mode`
- `[Slack] Commands registered`
- `[Slack] Gateway ready`

## Smoke Validation (Live Workspace)

1. Startup:

```bash
npm run slack:start
```

2. Command routing in Slack:

- `/mission help`
- `/mission list`
- `/mission run <mission-id>`
- `/mission status <mission-id>`

3. Progress and completion:

- Start a long-running mission.
- Confirm step updates appear (`Step x/y ...`).
- Confirm completion/failure summary appears.

4. Artifact retrieval:

- Run `/artifact <mission-id>`.
- Confirm `Artifacts ready` with download buttons.
- Click button and confirm upload completes.

## Failure Examples

Missing token failures (startup):

- `Missing Slack configuration: SLACK_BOT_TOKEN`
- `Missing Slack configuration: SLACK_APP_TOKEN`
- `Missing Slack configuration: SLACK_SIGNING_SECRET`

Artifact failures:

- `SLACK_ARTIFACT_NOT_FOUND: <path>`
- `SLACK_UNSUPPORTED_FILE_TYPE: .<ext>`
- `SLACK_UPLOAD_FAILED: <reason>`

## Deterministic Do/Don't

Do:

- Keep Slack as a thin command + notification layer.
- Route mission operations through existing controller/service boundaries.
- Use `/mission help` for discoverability.

Don't:

- Add mission state mutation logic inside Slack modules.
- Treat Slack payloads as runtime source of truth.
- Add random or time-based formatting behavior.
