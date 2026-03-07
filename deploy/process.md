# Sprint 74 Deployment Process

1. Copy `deploy/env.example` to `.env` and set secrets.
2. Start runtime API: `npm run runtime:start`.
3. Start cockpit: `npm run cockpit:start`.
4. Start slack adapter: `npm run slack:start`.
5. For local multi-service startup, use `npm run runtime:dev` or `bash scripts/dev-up.sh`.
