#!/usr/bin/env bash
# Launch Obsidian with the CDP debugging port the electron MCP server
# attaches to (it scans 9222-9225), then open the e2e test vault.
# Usage: tests/e2e/launch-obsidian.sh [port]
set -euo pipefail

PORT="${1:-9222}"
VAULT="$(cd "$(dirname "$0")/vault" && pwd)"

# Build first so the vault's symlinked plugin runs the current code.
(cd "$(dirname "$0")/../.." && npm run build)

if pgrep -x Obsidian >/dev/null; then
    echo "Obsidian is already running. Quit it first so it can be" >&2
    echo "relaunched with --remote-debugging-port=$PORT." >&2
    exit 1
fi

# Obsidian only opens vaults it already knows about, even via
# obsidian://open?path=. Register the e2e vault in its global vault
# list (obsidian.json) before launch, since that file is read at
# startup and must not be edited while Obsidian is running.
CONFIG="$HOME/Library/Application Support/obsidian/obsidian.json"
python3 - "$CONFIG" "$VAULT" <<'PY'
import json, sys, os, time

config_path, vault_path = sys.argv[1], sys.argv[2]
try:
    with open(config_path) as f:
        data = json.load(f)
except FileNotFoundError:
    data = {}

vaults = data.setdefault("vaults", {})
if not any(v.get("path") == vault_path for v in vaults.values()):
    vault_id = os.urandom(8).hex()
    vaults[vault_id] = {"path": vault_path, "ts": int(time.time() * 1000)}
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w") as f:
        json.dump(data, f)
PY

/Applications/Obsidian.app/Contents/MacOS/Obsidian \
    --remote-debugging-port="$PORT" &
sleep 3

open "obsidian://open?path=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$VAULT")"

echo
echo "Obsidian is up with CDP on port $PORT, vault: $VAULT"
echo "First run only: accept the 'Trust author and enable plugins' dialog."
