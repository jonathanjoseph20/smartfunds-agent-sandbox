# Team Template v1

This template defines a domain-agnostic baseline team structure for internal SmartFunds replication.

## Usage

Use the scaffolder from repository root:

```bash
scripts/create-team.sh <team-name> [--domain <domain>] [--template <path>]
```

The script copies this template into `teams/<team-name>` and writes a generated `TEAM.json` manifest for the instantiated team.
