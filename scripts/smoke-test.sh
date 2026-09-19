#!/usr/bin/env bash
# Post-deploy smoke test. Usage: scripts/smoke-test.sh https://mafk-web.jonas-268.workers.dev
#
# Retries because a fresh deploy can take a few seconds to reach every edge.
# Fails (non-zero) unless the home page serves and /api/health reports ok.
set -euo pipefail

base="${1:?usage: smoke-test.sh <base-url>}"
base="${base%/}"
curl_opts=(--fail --silent --show-error --retry 6 --retry-delay 5 --retry-all-errors --max-time 20)

curl "${curl_opts[@]}" --output /dev/null "$base/"
echo "ok  $base/"

health=$(curl "${curl_opts[@]}" "$base/api/health")
echo "    $base/api/health → $health"
if [[ "$health" != *'"status":"ok"'* ]]; then
  echo "health check did not report ok" >&2
  exit 1
fi
echo "ok  $base/api/health"
