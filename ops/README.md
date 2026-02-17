# Ops Tooling

All git and Codex work is canonicalized to:

- `/srv/repos/smartfunds-agent-sandbox`

## Structure

- `ops/install/install_openclaw_paths.sh` — Creates repo-local shell helper template.
- `ops/install/install_wrappers.sh` — Creates repo-local command wrappers.
- `ops/templates/` — Generated templates and wrapper artifacts.

## Usage

```bash
cd /srv/repos/smartfunds-agent-sandbox
ls ops/install
bash ops/install/install_openclaw_paths.sh
bash ops/install/install_wrappers.sh
```

## Session Start Contract

At the beginning of each session run:

```bash
cdsf
pwd
git status
```

## Restrictions

- Do not run Codex or git workflows in legacy `/root` SmartFunds workspace paths.
- Do not write into any `*.nongit*` folder.
- Do not write to system-level locations from these scripts.
