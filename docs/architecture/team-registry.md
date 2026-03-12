# Team Registry

## Purpose

Team is the next bounded object after Mission Control because missions and templates already exist, but there is no deterministic persistent control-plane unit representing organizational execution intent.

Sprint 4.1 adds that missing unit with a deterministic Team Registry layer.

## What Team Registry Does

The Team Registry provides pre-execution representation for:

- team identity
- purpose and domain tags
- capability profile
- supported mission and template references
- lifecycle, availability, and readiness posture
- append-only history projection
- projection and artifact materialization

It does not perform routing, assignment, scheduling, invocation, or runtime execution.

## Pre-Execution Boundary

Sprint 4.1 is descriptive only.

Not supported in this sprint:

- mission-to-team routing
- team invocation
- queue/scheduler semantics
- runtime agent execution
- automatic activation

## State Semantics

### Lifecycle

`defined | active | dormant | archived`

Lifecycle describes structural posture of the team definition.

### Availability

`available | restricted | unavailable | manual_only`

Availability describes future assignment eligibility posture, not runtime execution.

### Readiness

`ready | partial | blocked | incomplete | inconclusive`

Readiness represents structural confidence for future assignment surfaces.

- `ready`: structurally valid with valid references and no contradictions
- `partial`: valid core structure but intentionally sparse placeholder posture
- `blocked`: hard invalidity or contradiction
- `incomplete`: valid structure but missing important support mappings
- `inconclusive`: conflicting conditions prevent confident status

## Operating Modes

`continuous | on_demand | dormant_reserve`

Operating modes are descriptive metadata in Sprint 4.1. They do not activate execution behavior.

## Roster Policy

Roster policy is metadata only in Sprint 4.1.

It captures shape constraints:

- policy type (`fixed | expandable | placeholder`)
- min/max bounds
- required capabilities

No runtime agent assignment semantics are introduced.

## Relation to Missions and Templates

Teams may reference supported mission types and template IDs.

These references are validated deterministically against existing mission/template definitions where available. They are descriptive only and do not trigger routing.

## Deterministic Design Principles

- canonical JSON output via `canonicalStringify`
- stable sorting for filesystem and collections
- semantic identity hashing via `sha256`
- no randomness or timestamp-derived identity
- append-only deterministic history derivation

## Artifact Truth Separation

Artifacts under `artifacts/teams/<teamId>/` are projections only.

Source of truth remains:

- team definitions
- validation
- status evaluation
- derived history

Materialization never mutates source truth.
