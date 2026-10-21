#!/usr/bin/env bash
set -euo pipefail

ARC_PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCODE_BIN="${OPENCODE_BIN:-/home/project-user/.opencode/bin/opencode}"
PROMPT_FILE="$ARC_PROJECT/integrations/opencode/ARC_AUTOPLAY_PROMPT.md"

if [[ ! -f "$ARC_PROJECT/.env" ]]; then
  echo "ARC environment file is missing: $ARC_PROJECT/.env" >&2
  exit 1
fi
if [[ ! -x "$OPENCODE_BIN" ]]; then
  echo "OpenCode executable is missing: $OPENCODE_BIN" >&2
  exit 1
fi

set -a
source "$ARC_PROJECT/.env"
set +a

export PATH="$ARC_PROJECT/.tooling/node/bin:/usr/bin:/bin"
export PACKY_API_KEY="${MODEL_API_KEY:?MODEL_API_KEY is missing from $ARC_PROJECT/.env}"
export ARC_AGENT_API_URL="${ARC_AGENT_API_URL:-http://127.0.0.1:4175}"
export ARC_MANAGED_BROWSER="${ARC_MANAGED_BROWSER:-1}"

cd "$ARC_PROJECT"
if (( $# > 0 )); then
  exec "$OPENCODE_BIN" "$@"
fi

level="${ARC_LEVEL:-rf01}"
view="${ARC_VIEW:-dual}"
harness="${ARC_HARNESS:-visual}"
model="${ARC_MODEL:-packy/glm-5}"
prompt="$(<"$PROMPT_FILE")"
prompt+=$'\n\nRun settings:'
prompt+=$'\n- level: '"$level"
prompt+=$'\n- view: '"$view"
prompt+=$'\n- harness: '"$harness"

exec "$OPENCODE_BIN" run --model "$model" --title "ARC autoplay: $level" "$prompt" </dev/null
