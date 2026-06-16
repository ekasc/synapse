#!/usr/bin/env bash
set -euo pipefail

# Syncthing conflict files break SvelteKit route discovery when they land under src/routes.
# This removes only Syncthing's conflict/version artifacts, never real +page.svelte files.
find . \
  \( -name '*.sync-conflict-*' -o -name '.syncthing.*' -o -name '*.tmp' \) \
  -type f \
  -print \
  -delete

find . -type d -name '.stversions' -prune -print -exec rm -rf {} +
