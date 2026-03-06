# Registry Model (Sprint 61)

## Purpose

Sprint 61 flattens governance project registration so ownership and project metadata are read from one canonical source.

Canonical source for governance:

`entities/projects/*.json`

## Old Model vs New Model

Old model (ambiguous):

- ownership could come from `entities/projects/*.json` or fall back to `control-plane/projects/*.json`
- entity association came from `control-plane/entities/registry.json` project lists
- multiple similarly named files created frequent misconfiguration

New model (flattened for governance):

- governance ownership reads only `entities/projects/*.json`
- governance entity/pod/mode mapping reads only `entities/projects/*.json`
- `control-plane/entities/registry.json` is retained for entity existence/legal metadata compatibility
- `control-plane/projects/*.json` is non-canonical for governance ownership

## Canonical Project Spec

Each file under `entities/projects/` must include:

- `id` (kebab-case, unique)
- `name`
- `entity`
- `pod`
- `mode` (`explore` | `structured` | `regulated`)
- `ownedPaths` (directory prefixes ending with `/`)
- `ownedFiles` (exact file paths)

Optional metadata can remain in the same file.

## Resolution Flow

Governance dependency order:

1. load and validate canonical projects from `entities/projects/*.json`
2. validate `entity` references against `control-plane/entities/registry.json` (if present)
3. validate `pod` references against `entities/pods/*.json` (if present)
4. build deterministic ownership matchers from `ownedPaths` + `ownedFiles`
5. resolve changed files to projects/entities/pods/mode
6. enforce governance policy (unchanged)

## Determinism Guarantees

- JSON files are loaded in sorted filename order
- project IDs are sorted
- ownership arrays are normalized and sorted
- overlap validation is deterministic
- ownership diagnostics are emitted in sorted file order

## Ownership Semantics (Unchanged)

- explicit path-prefix and exact-file matching only
- unowned files fail
- overlapping ownership definitions fail
- multi-project changes remain enforced by existing policy
- no heuristic/fuzzy ownership is used for enforcement

## Legacy Source Authority Note

`control-plane/projects/*.json` remains for non-governance compatibility (for example swarm/runtime flows still using that registry shape).

It is **not** authoritative for governance ownership or project entity/pod/mode mapping.
