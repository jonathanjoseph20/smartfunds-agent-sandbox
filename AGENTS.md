# SmartFunds Phase 1 — Agent Instructions

## What This Is
SmartFunds is an SEC-registered transfer agent building a regulated issuance platform.
This repo is the Phase 1 MVP: a 506(c) issuance engine.

## Tech Stack
- TypeScript (strict mode, ES modules)
- Node.js 22+ (uses native node:sqlite — no ORM, no Prisma, no Drizzle)
- npm workspaces (monorepo)
- Vitest for testing
- Hono for the API framework (not Express)
- ESLint with @typescript-eslint

## Monorepo Structure
apps/api/              — Backend REST API (Hono)
apps/web/              — Placeholder for future UI
packages/shared/       — Shared types, enums, interfaces
packages/mission-engine/ — Mission state machine, audit log, composition, verification, packaging
packages/doc-factory/  — Legal template registry + document assembly
packages/compliance/   — Accreditation gate, signature gate, subscription enforcement
packages/exports/      — Export pack generation (CSVs + manifest)
policies/              — Risk tier definitions

## Testing
- Use Vitest (not Jest)
- Test files use .test.ts extension
- Use in-memory SQLite (:memory:) for test databases
- Reference spec test IDs in test names: T-M1, T-L1, T-E1, etc.
- Run tests: npm test from root

## Setup Commands
npm install
npm run build
npm test

## Key Rules
1. No ORM — use DatabaseSync from node:sqlite directly
2. All IDs: crypto.randomUUID()
3. All timestamps: ISO 8601 UTC
4. Database path configurable via parameter (tests use :memory:)
5. Phase 1 only supports 506(c) — exemption_type always 506C
6. Mission states are strictly ordered — no skipping
7. Every state transition creates an audit log entry
8. Blueprint is immutable after approval (frozen)
9. Offering packages cannot be overwritten
10. Use ES modules (not CommonJS) throughout

## Mission State Machine
INTAKE -> LEGAL_STRUCTURING -> COMPOSITION -> IMPLEMENTATION -> PR_GATE -> VERIFICATION -> HUMAN_CHECKPOINT -> APPROVED -> LAUNCHED -> ARCHIVED

Rejection loops: VERIFICATION -> IMPLEMENTATION, HUMAN_CHECKPOINT -> IMPLEMENTATION

## API Conventions
- JSON responses
- 201 for creation, 200 for reads, 400 for validation errors, 404 for not found, 409 for conflicts
- Error format: { "error": "message" }

## Do NOT
- Do not use Express (use Hono)
- Do not use CommonJS require() (use ES module import)
- Do not use any ORM
- Do not add features not in the current task prompt
- Do not use Jest (use Vitest)
