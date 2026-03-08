#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/publish.sh [patch|minor|major]
BUMP=${1:-patch}

if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# ── 1. CHANGELOG guard ───────────────────────────────────────────────────────
UNRELEASED=$(awk '/^## \[Unreleased\]/{found=1; next} found && /^## \[/{exit} found{print}' CHANGELOG.md | grep -v '^\s*$' || true)
if [[ -z "$UNRELEASED" ]]; then
  echo "✗ CHANGELOG.md의 [Unreleased] 섹션이 비어있습니다. 릴리즈 노트를 작성하세요."
  exit 1
fi

# ── 2. test & build ──────────────────────────────────────────────────────────
echo "▶ Running tests..."
npm run test

echo "▶ Building..."
npm run build

# ── 3. version bump (no git commit yet) ──────────────────────────────────────
npm version "$BUMP" --no-git-tag-version --workspace=apps/cli

NEW_VERSION=$(node -p "require('./apps/cli/package.json').version")
echo "▶ Bumped to v$NEW_VERSION"

# ── 4. CHANGELOG 업데이트 ([Unreleased] → [x.y.z] - YYYY-MM-DD) ─────────────
TODAY=$(date +%Y-%m-%d)
sed -i '' "s/^## \[Unreleased\]/## [Unreleased]\n\n## [$NEW_VERSION] - $TODAY/" CHANGELOG.md
echo "▶ CHANGELOG.md updated for v$NEW_VERSION"

# ── 5. git commit + tag ───────────────────────────────────────────────────────
git add apps/cli/package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# ── 6. publish (cli only) ─────────────────────────────────────────────────────
echo "▶ Publishing ai-ops-cli@$NEW_VERSION..."
npm publish --workspace=apps/cli

# ── 7. push ───────────────────────────────────────────────────────────────────
echo ""
read -rp "Push commit + tag to origin? [y/N] " PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  git push && git push --tags
  echo "✓ Pushed v$NEW_VERSION"
fi

echo "✓ Done — ai-ops-cli@$NEW_VERSION"
