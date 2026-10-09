#!/usr/bin/env bash
# Points git at the versioned hooks in .githooks/. Run once per clone:
#   ./scripts/install-hooks.sh
#
# The hooks live in .githooks/ rather than .git/hooks so they are versioned,
# reviewable, and survive a fresh clone. core.hooksPath is per-clone config,
# which is why this still needs running once.
#
# It also repairs a stale setting: this repo's core.hooksPath pointed at
# ../GapSign/.git/hooks (the pre-rename path) long after that directory was
# deleted, so every hook here was silently dead — a pushed release tag ran
# nothing at all. A relative path cannot rot that way.
set -euo pipefail

cd "$(dirname "$0")/.."

current="$(git config --get core.hooksPath || true)"
if [ -n "$current" ] && [ "$current" != ".githooks" ]; then
  echo "Replacing core.hooksPath: $current -> .githooks"
fi

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "Hooks active from .githooks:"
ls -1 .githooks
