# Deployment Runbook (Sprint 74)

## Environment

Set these environment variables:

- `SMARTFUNDS_RUNTIME_PORT`
- `SMARTFUNDS_ENV`
- `SMARTFUNDS_LOG_LEVEL`
- `SMARTFUNDS_RUNTIME_BASE_URL`
- `SMARTFUNDS_CORS_ORIGIN`
- `SMARTFUNDS_COCKPIT_PORT`
- `SMARTFUNDS_DATA_DIR`
- `SMARTFUNDS_CONFIG_DIR`
- `SLACK_BOT_TOKEN` (optional)
- `SLACK_SIGNING_SECRET` (optional)

## Startup

1. Runtime API: `npm run runtime:start`
2. Cockpit UI: `npm run cockpit:start`
3. Slack adapter: `npm run slack:start`

Local multi-service up:

- `npm run runtime:dev`

Containerized startup:

- `docker compose -f deploy/docker-compose.yml up --build`
