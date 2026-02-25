#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
BACKUP_FILE=".pr-body.md.demo-backup"
BODY_FILE=".pr-body.md"
LABELS_FILE=".pr-labels.txt"
FIXED_COMMIT_DATE="2000-01-01T00:00:00Z"

SCENARIOS=(
  "autonomous-pass"
  "structured-fail"
  "structured-pass"
  "mixed-fail"
)

created_branches=()
backup_created=0
start_branch=""

print_usage() {
  echo "Usage: scripts/demo.sh [--scenario <name>]"
  echo "Scenarios: ${SCENARIOS[*]}"
}

ensure_repo() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Run this script inside a git repository." >&2
    exit 1
  fi
}

ensure_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. Commit or stash changes before running the demo." >&2
    echo "Run: git status -sb" >&2
    exit 1
  fi
}

ensure_on_main() {
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" != "main" ]]; then
    echo "Current branch is ${branch}. Switch to main before running the demo." >&2
    echo "Run: git checkout main" >&2
    exit 1
  fi
}

backup_body_file() {
  if [[ -f "$BACKUP_FILE" ]]; then
    echo "Backup file ${BACKUP_FILE} already exists. Remove it before running the demo." >&2
    exit 1
  fi

  if [[ -f "$BODY_FILE" ]]; then
    cp "$BODY_FILE" "$BACKUP_FILE"
    backup_created=1
  fi
}

restore_body_file() {
  if [[ $backup_created -eq 1 ]]; then
    mv "$BACKUP_FILE" "$BODY_FILE"
  else
    rm -f "$BODY_FILE"
  fi
}

cleanup() {
  set +e
  if [[ -n "$start_branch" ]]; then
    git checkout "$start_branch" >/dev/null 2>&1
  fi
  for branch in "${created_branches[@]}"; do
    if git show-ref --verify --quiet "refs/heads/${branch}"; then
      git branch -D "$branch" >/dev/null 2>&1
    fi
  done
  rm -f "$LABELS_FILE"
  restore_body_file
}

trap cleanup EXIT

parse_args() {
  local scenario=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --scenario)
        scenario="$2"
        shift 2
        ;;
      --scenario=*)
        scenario="${1#--scenario=}"
        shift
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        print_usage
        exit 1
        ;;
    esac
  done

  if [[ -n "$scenario" ]]; then
    local found=0
    for known in "${SCENARIOS[@]}"; do
      if [[ "$known" == "$scenario" ]]; then
        found=1
        break
      fi
    done
    if [[ $found -eq 0 ]]; then
      echo "Unknown scenario: ${scenario}" >&2
      print_usage
      exit 1
    fi
    SCENARIOS=("$scenario")
  fi
}

scenario_config() {
  local scenario="$1"
  local tier=""
  local expected=""
  local files=()

  case "$scenario" in
    autonomous-pass)
      tier="1"
      expected="PASS"
      files=("apps/api/demo/demo-autonomous-pass.txt")
      ;;
    structured-fail)
      tier="1"
      expected="FAIL"
      files=("governance/demo/demo-structured-fail.txt")
      ;;
    structured-pass)
      tier="2"
      expected="PASS"
      files=("governance/demo/demo-structured-pass.txt")
      ;;
    mixed-fail)
      tier="2"
      expected="FAIL"
      files=("apps/api/demo/demo-mixed-fail.txt" "governance/demo/demo-mixed-fail.txt")
      ;;
    *)
      echo "Unknown scenario: ${scenario}" >&2
      exit 1
      ;;
  esac

  echo "$tier|$expected|${files[*]}"
}

create_marker_files() {
  local scenario="$1"
  shift
  local files=("$@")

  for file in "${files[@]}"; do
    mkdir -p "$(dirname "$file")"
    printf '%s\n' "// demo: ${scenario} marker" > "$file"
  done
}

commit_changes() {
  local scenario="$1"
  shift
  local files=("$@")

  git add "${files[@]}"
  GIT_AUTHOR_DATE="$FIXED_COMMIT_DATE" GIT_COMMITTER_DATE="$FIXED_COMMIT_DATE" \
    git commit -m "demo: ${scenario} marker" >/dev/null
}

run_preflight() {
  set +e
  local output
  output=$(npm run governance:preflight 2>&1)
  local status=$?
  set -e
  printf '%s\n' "$status" "${output}"
}

render_summary() {
  local scenario="$1"
  local expected="$2"
  local actual="$3"
  local output="$4"

  local mode_line
  mode_line=$(printf '%s\n' "$output" | grep '^Mode Enforcement:' | head -n 1 || true)

  local status
  status=$(printf '%s\n' "$mode_line" | sed -E 's/^Mode Enforcement: ([^ ]+).*$/\1/' || true)
  if [[ -z "$status" || "$status" == "$mode_line" ]]; then
    status="unknown"
  fi

  local violation
  violation=$(printf '%s\n' "$mode_line" | sed -nE 's/^Mode Enforcement: [^ ]+ \(([^)]+)\).*/\1/p')
  if [[ -z "$violation" ]]; then
    violation="null"
  fi

  local required
  required=$(printf '%s\n' "$output" | grep '^Mode Required Minimum Tier:' | head -n 1 | sed -E 's/^Mode Required Minimum Tier: (.*)$/\1/' || true)
  if [[ -z "$required" ]]; then
    required="null"
  fi

  echo "Scenario: ${scenario}"
  echo "Expected: ${expected}"
  echo "Actual: ${actual}"
  echo "modeEnforcementStatus: ${status}"
  echo "modeViolation: ${violation}"
  echo "requiredMinimumTier: ${required}"
}

run_scenario() {
  local scenario="$1"
  local config
  config=$(scenario_config "$scenario")

  local tier
  local expected
  local files_str

  tier="${config%%|*}"
  config="${config#*|}"
  expected="${config%%|*}"
  files_str="${config#*|}"

  IFS=' ' read -r -a files <<< "$files_str"

  local branch="demo/${scenario}"
  git checkout -b "$branch" >/dev/null
  created_branches+=("$branch")

  create_marker_files "$scenario" "${files[@]}"
  commit_changes "$scenario" "${files[@]}"

  npm run governance:generate -- --tier "$tier" --out "$BODY_FILE" >/dev/null

  local result
  result=$(run_preflight)
  local status_code
  status_code=$(printf '%s\n' "$result" | head -n 1)
  local output
  output=$(printf '%s\n' "$result" | tail -n +2)

  local actual
  if [[ "$status_code" == "0" ]]; then
    actual="PASS"
  else
    actual="FAIL"
  fi

  render_summary "$scenario" "$expected" "$actual" "$output"
  echo ""

  rm -f "$BODY_FILE"
  git checkout main >/dev/null
  git branch -D "$branch" >/dev/null
}

main() {
  parse_args "$@"
  ensure_repo
  ensure_clean_worktree
  ensure_on_main
  start_branch="$(git rev-parse --abbrev-ref HEAD)"
  backup_body_file

  echo "Running governance mode enforcement demo..."
  echo ""

  for scenario in "${SCENARIOS[@]}"; do
    run_scenario "$scenario"
  done

  echo "Demo complete."
}

main "$@"
