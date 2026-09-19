#!/usr/bin/env bash
# Ship to production from this machine — the only deploy path. CI verifies
# every push but never deploys. Uses your logged-in wrangler (OAuth, see
# `wrangler whoami`), so no API token exists anywhere.
#
# Refuses to ship anything that isn't a commit on main, so every live version
# maps to a commit (its message is the deploy message in the dashboard).
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://mafk-web.jonas-268.workers.dev"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Uncommitted changes — commit or stash before shipping." >&2
  exit 1
fi
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "On '$branch' — ship from main." >&2
  exit 1
fi

sha="$(git rev-parse --short HEAD)"
if git fetch --quiet origin main 2>/dev/null && [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "Note: $sha is not what origin/main points at — push after shipping."
fi

pnpm verify
pnpm exec wrangler deploy --message "$sha $(git log -1 --format=%s)"
scripts/smoke-test.sh "$URL"
echo "Shipped $sha to $URL"
