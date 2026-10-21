#!/usr/bin/env bash
set -euo pipefail

ARC_PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_FILE="$ARC_PROJECT/integrations/opencode/ARC_AUTOPLAY_PROMPT.md"
CHROME_EXECUTABLE="${ARC_CHROMIUM_EXECUTABLE:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PUPPETEER_ENTRY="${ARC_PUPPETEER_ENTRY:-$(npm root -g 2>/dev/null)/puppeteer-core/lib/puppeteer/puppeteer-core.js}"

if [[ -z "${PACKY_API_KEY:-}" ]]; then
  echo "请先设置 PACKY_API_KEY 环境变量。" >&2
  exit 1
fi
if [[ ! -x "$CHROME_EXECUTABLE" ]]; then
  echo "Chrome 不存在：$CHROME_EXECUTABLE" >&2
  exit 1
fi
if [[ ! -f "$PUPPETEER_ENTRY" ]]; then
  echo "puppeteer-core 入口不存在：$PUPPETEER_ENTRY" >&2
  exit 1
fi

export ARC_AGENT_API_URL="${ARC_AGENT_API_URL:-http://49.233.44.228:4175}"
export ARC_MANAGED_GAME_URL="${ARC_MANAGED_GAME_URL:-http://49.233.44.228:4175}"
export ARC_MANAGED_BROWSER="${ARC_MANAGED_BROWSER:-1}"
export ARC_HEADLESS="${ARC_HEADLESS:-1}"
export ARC_CHROMIUM_EXECUTABLE="$CHROME_EXECUTABLE"
export ARC_PUPPETEER_ENTRY="$PUPPETEER_ENTRY"
export ARC_BROWSER_READY_TIMEOUT_MS="${ARC_BROWSER_READY_TIMEOUT_MS:-120000}"
export ARC_BROWSER_OBSERVATION_TIMEOUT_MS="${ARC_BROWSER_OBSERVATION_TIMEOUT_MS:-120000}"
export ARC_COMMAND_TIMEOUT_MS="${ARC_COMMAND_TIMEOUT_MS:-180000}"
export ARC_BROWSER_WIDTH="${ARC_BROWSER_WIDTH:-960}"
export ARC_BROWSER_HEIGHT="${ARC_BROWSER_HEIGHT:-600}"

cd "$ARC_PROJECT"
if (( $# > 0 )); then
  exec opencode "$@"
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

exec opencode run --model "$model" --title "ARC local autoplay: $level" "$prompt" </dev/null
