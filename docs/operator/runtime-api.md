# Operator Runtime API Endpoints

## Health

- `GET /health`

## Missions

- `GET /missions`
- `GET /missions/:missionId`
- `POST /missions/:missionId/start`
- `POST /missions/:missionId/cancel`
- `GET /missions/:missionId/agents`

## Teams

- `GET /teams/:teamId`

## Workflows

- `GET /workflows`
- `GET /workflows/:workflowId`
- `GET /workflows/:workflowId/inspect`

## Runs

- `GET /runs`
- `GET /runs/:runId`
- `GET /runs/:runId/trace`
- `GET /runs/:runId/failures`
- `GET /runs/:runId/nodes/:nodeId`
- `POST /runs/:runId/retry` (body: `{ "nodeId": "..." }`)
- `POST /runs/:runId/resume`
- `POST /runs/:runId/cancel`

## Runtime

- `GET /runtime/limits`

## Response Contract

Success:

```json
{
  "success": true,
  "payload": {},
  "meta": {
    "source": "operator-runtime-api",
    "version": "v1"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "...",
    "details": {}
  }
}
```
