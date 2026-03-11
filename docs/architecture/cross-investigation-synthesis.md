# Cross-Investigation Synthesis Layer

## Scope

Productization Phase 11 adds a bounded cross-investigation synthesis layer.

This layer is:
- deterministic
- additive over existing investigation outputs
- bounded by explicit synthesis definitions
- traceable back to linked investigations and findings
- operator inspectable by CLI

This layer is not:
- cohorts
- swarms
- generalized orchestration
- dashboarding
- Slack loops
- open-ended narrative generation

## Layer Position

runtime
-> scheduler
-> persistent research runtime
-> signal bus
-> trigger layer
-> investigation layer
-> investigation scheduler integration
-> evidence + confidence
-> continuity + revision
-> completion + convergence
-> cross-investigation synthesis

## Synthesis Set Contract

A synthesis set is a durable bounded unit:
- `synthesisId`
- `synthesisType`
- `subjectKey`
- `linkedInvestigationIds[]`
- `status` (`pending | active | completed | inconclusive`)
- artifact references (`synthesis-report.json`, `synthesis-report.md`)

Identity is deterministic: `sha256(canonicalStringify({ synthesisType, subjectKey }))`.

## Bounded Definitions

Definitions are seeded in:
- `control-plane/synthesis/definitions/*.json`

Each definition declares:
- `synthesisType`
- `supportedDimensions`
- `sourceSignalTypes`
- `sourceInvestigationDefinitionIds`

Only definition-eligible investigations can be linked.

## Deterministic Linking

Linking is explicit and deterministic:
- load investigations
- filter by definition signal/investigation types
- derive link dimensions from structured metadata
- produce `subjectKey` values (for example `protocol:aave`)
- attach `linkedReasons[]` (for example `same protocol=aave`)
- sort linked investigation IDs and reasons stably

No fuzzy similarity, embeddings, or semantic heuristics are used.

## Aggregation Engine

The synthesis engine:
- projects linked investigations (status, findings, confidence band, completion states, limitations)
- computes reinforcing and conflicting patterns
- builds synthesis findings with supporting and conflicting references
- computes synthesis confidence (`overallBand`, supporting/weakening factors, unresolved conflicts)
- classifies synthesis status (`pending | active | completed | inconclusive`)
- writes durable report artifacts
- persists append-only synthesis history events

## Confidence Model

Confidence is rule-based and explainable.

Positive factors:
- linked investigation count
- completed/ready investigation count
- high/medium underlying confidence bands
- reinforcement across investigations

Weakening factors:
- material conflicts
- incomplete investigations
- propagated unresolved limitations

Output shape:
- `overallBand: low | medium | high`
- `supportingFactors[]`
- `weakeningFactors[]`
- `unresolvedConflicts[]`

## Conflict Handling

Conflict visibility is first-class:
- conflicting findings are grouped deterministically
- conflicts include conflicting investigation IDs and finding IDs
- unresolved conflicts propagate into confidence and report outputs
- synthesis status becomes `inconclusive` for material contradiction

Disagreement is not flattened into a single narrative.

## Persistence And Artifacts

Synthesis history is append-only:
- `syntheses/<YYYY-MM-DD>/synthesis-events.json`

Artifacts are durable:
- `artifacts/synthesis/<synthesisId>/synthesis-report.json`
- `artifacts/synthesis/<synthesisId>/synthesis-report.md`

## Future Composability

This layer is the bounded synthesis substrate for future coordinated research layers.

It intentionally stops at deterministic cross-investigation synthesis and does not introduce team/swarm/orchestration semantics in this sprint.
