# Governance Ownership Debugging Runbook

## 1. Run Preflight

Run:

`npm run governance:preflight`

The output now states the authoritative source:

`Project registry source: entities/projects/*.json`

## 2. Inspect Governance Metadata

From the governance report, inspect at minimum:

- `projectsTouched`
- `ownershipStatus`
- `unownedFiles`
- `entityOwnershipStatus`
- `entityByProject`
- `podsTouched`

## 3. Inspect Canonical Project File

For each touched project, open the file in:

`entities/projects/<project-id>.json`

Verify:

- `entity`
- `pod`
- `mode`
- `ownedPaths`
- `ownedFiles`

## 4. Resolve Common Failures

Unowned file:

- confirm the file path is covered by `ownedPaths` prefix or `ownedFiles` exact path
- use the preflight suggestion (candidate project + suggested `ownedPaths` fix)

Conflicting ownership:

- preflight shows conflicting projects and matched patterns
- remove overlap so each file maps to exactly one project

Unknown entity:

- ensure `entity` in `entities/projects/*.json` exists in `control-plane/entities/registry.json`

Unknown pod:

- ensure `pod` in `entities/projects/*.json` exists in `entities/pods/*.json`

## 5. Re-run Preflight

After updates:

`npm run governance:preflight`

Do not rely on CI reruns to refresh metadata. Push a new commit when PR metadata/evidence changed.

## Debug Order

Follow dependency order:

1. canonical project schema validity
2. entity/pod reference validity
3. ownership coverage and overlap
4. governance metadata and tier labels
