# Evidence-Backed Investigations Runbook

## Purpose

Use this runbook to inspect investigation evidence and confidence for deterministic, evidence-backed reporting.

## Commands

Inspect evidence records:

```bash
npm run investigations:evidence -- --investigation <investigationRunId>
```

Inspect confidence summary and phase evolution:

```bash
npm run investigations:confidence -- --investigation <investigationRunId>
```

Inspect evidence-backed findings:

```bash
npm run investigations:findings -- --investigation <investigationRunId>
```

Read final report:

```bash
npm run investigations:report -- --investigation <investigationRunId>
```

## How To Interpret Confidence

- `high`: strong supporting evidence with limited weaknesses
- `medium`: meaningful support with notable limitations
- `low`: sparse support and/or substantial counter-evidence or unresolved gaps

Always inspect:
- `strengths`
- `limitations`
- linked supporting/counter/gap evidence IDs

## Evidence Location

Per investigation run:

`artifacts/investigations/<investigationRunId>/evidence/evidence.json`

This file accumulates across scheduler cycles and resumed phases.

## Confidence Evolution

Use `investigations:confidence` and inspect `confidenceByPhase` to see if confidence improved as phases progressed.

Confidence can improve when:
- supporting evidence increases
- evidence type diversity increases
- cross-cycle confirmation appears

Confidence can degrade when:
- counter-evidence appears
- unresolved gaps increase
