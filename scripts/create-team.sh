#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: scripts/create-team.sh <team-name> [--domain <domain>] [--template <path>]" >&2
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

team_name="$1"
shift

if [[ -z "$team_name" ]]; then
  echo "Team name cannot be empty." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
default_template="${script_dir}/../agent-templates/team-template-v1"
template_path="$default_template"
domain="general"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --domain." >&2
        usage
        exit 1
      fi
      domain="$2"
      shift 2
      ;;
    --template)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --template." >&2
        usage
        exit 1
      fi
      template_path="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -d "$template_path" ]]; then
  echo "Template path does not exist: $template_path" >&2
  exit 1
fi

if [[ ! -f "$template_path/TEAM.json" ]]; then
  echo "Template TEAM.json not found at: $template_path/TEAM.json" >&2
  exit 1
fi

output_dir="teams/$team_name"
if [[ -e "$output_dir" ]]; then
  echo "Target team directory already exists: $output_dir" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_dir")"
cp -R "$template_path" "$output_dir"

template_version="$(node --input-type=module -e 'import fs from "node:fs"; const p = process.argv[1]; const data = JSON.parse(fs.readFileSync(p, "utf8")); if (!data.version) process.exit(2); process.stdout.write(String(data.version));' "$template_path/TEAM.json")"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "$output_dir/TEAM.json" <<JSON
{
  "team_name": "$team_name",
  "created_at": "$created_at",
  "template_version": "$template_version",
  "domain": "$domain"
}
JSON

echo "Created team at $output_dir"
