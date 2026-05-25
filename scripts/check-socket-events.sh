#!/usr/bin/env bash
# Fail if backend/socket_events.json and frontend/src/lib/socket-events.json drift apart.
# Compares semantic content (ignores the _comment field) using jq.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 2
fi

a=$(jq 'del(._comment)' backend/socket_events.json)
b=$(jq 'del(._comment)' frontend/src/lib/socket-events.json)

if [ "$a" != "$b" ]; then
  echo "Socket event manifests are out of sync:" >&2
  diff <(echo "$a") <(echo "$b") >&2
  exit 1
fi
echo "Socket event manifests match."
