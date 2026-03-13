# Controlled Execution Handoff Operations

## List Activation Records

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-list.ts
```

## Inspect a Single Activation Record

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-inspect.ts --activation <activation-id>
```

## Inspect Mapping

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-mappings.ts --activation <activation-id>
```

## Inspect Eligibility

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-eligibility.ts --activation <activation-id>
```

## Inspect Queue Posture

Single activation:

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-queue.ts --activation <activation-id>
```

All queue summaries:

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-queue.ts
```

## Inspect Feedback Links

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-feedback.ts --activation <activation-id>
```

## Inspect Status

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-status.ts --activation <activation-id>
```

## Inspect History

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-history.ts --activation <activation-id>
```

## Inspect Outcome

Use inspect output and read `outcome`, or use materialized output file.

## Materialize Activation Artifacts

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-materialize.ts --activation <activation-id>
```

## Bounded Append-Only Actions

Defer activation:

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-defer.ts --activation <activation-id>
```

Mark handoff submitted:

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-mark-submitted.ts --activation <activation-id>
```

Mark activation complete:

```bash
node --experimental-strip-types control-plane/cli/mission-control-activation-mark-complete.ts --activation <activation-id>
```

All commands return JSON-only output with deterministic key ordering and stable error payloads.
