# Service OS v1 Runbook

## Environment Contract

Required:
- `PORT` (default `3000`)
- `HOST` (default `127.0.0.1`)
- `SMARTFUNDS_DB_PATH` (SQLite path; defaults to `./smartfunds.db`)
- `SLACK_SIGNING_SECRET` (required for Slack webhook signature verification)

Slack outbound (choose one):
- Bot mode (recommended): `SLACK_BOT_TOKEN` + `SLACK_DEFAULT_CHANNEL`
- Webhook mode: `SLACK_WEBHOOK_URL`

Optional:
- `SERVICE_BASE_URL` (adds deterministic run links in Slack messages)
- `SERVICE_VERSION`
- `SERVICE_BUILD_SHA`

## Start Service

```bash
npm run service:start
```

With explicit bind:

```bash
HOST=0.0.0.0 PORT=3000 npm run service:start
```

## Verify Health

```bash
curl -s http://127.0.0.1:3000/health
```

Expected shape:
- `status: "ok"`
- `journalConnectivityOk: true`
- `slackConfigured: true|false`

## Slack App Configuration

Set request URLs:
- Interactivity: `https://<service-host>/webhooks/slack/actions`
- Event Subscriptions: `https://<service-host>/webhooks/slack/events`

Required bot scope (bot token mode):
- `chat:write`

Signing secret:
- Copy from Slack app settings to `SLACK_SIGNING_SECRET`.

## Operational Checks

- Trigger run flow: `POST /run/swarm`
- Inspect run: `GET /run/<runId>`
- Retry manually: `POST /run/<runId>/retry`
- Slack action dedupe response for duplicate click:
  - `{ "ok": true, "status": "duplicate_ignored", "webhookEventId": "..." }`

## Rollback

1. Stop service process/container.
2. Revert deployment to previous image/revision.
3. Restart with previous env contract.
4. Verify `GET /health` and run retrieval endpoints.
