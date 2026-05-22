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

# ── 1. test & build ──────────────────────────────────────────────────────────
echo "▶ Running tests..."
npm run test

echo "▶ Building..."
npm run build

# ── 2. version bump (no git commit yet) ──────────────────────────────────────
npm version "$BUMP" --no-git-tag-version --workspace=apps/cli

NEW_VERSION=$(node -p "require('./apps/cli/package.json').version")
npm version "$NEW_VERSION" --no-git-tag-version --workspace=apps/studio-darwin-arm64 --allow-same-version
npm pkg set "optionalDependencies.ai-ops-studio-darwin-arm64=$NEW_VERSION" --workspace=apps/cli
npm install --package-lock-only --ignore-scripts
echo "▶ Bumped to v$NEW_VERSION"

# ── 3. CHANGELOG 업데이트 ([Unreleased] → [x.y.z] - YYYY-MM-DD) ─────────────
TODAY=$(date +%Y-%m-%d)
sed -i '' "s/^## \[Unreleased\]/## [Unreleased]\n\n## [$NEW_VERSION] - $TODAY/" CHANGELOG.md
echo "▶ CHANGELOG.md updated for v$NEW_VERSION"

# ── 4. git commit + tag ───────────────────────────────────────────────────────
echo "▶ Preparing Studio macOS arm64 package..."
npm run studio:package:darwin-arm64

git add apps/cli/package.json apps/studio-darwin-arm64/package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# ── 5. publish platform package, then cli ─────────────────────────────────────
echo "▶ Publishing ai-ops-studio-darwin-arm64@$NEW_VERSION..."
npm publish --workspace=apps/studio-darwin-arm64

echo "▶ Publishing ai-ops-cli@$NEW_VERSION..."
npm publish --workspace=apps/cli

# ── 6. push ───────────────────────────────────────────────────────────────────
echo ""
read -rp "Push commit + tag to origin? [y/N] " PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  git push && git push --tags
  echo "✓ Pushed v$NEW_VERSION"
fi

echo "✓ Done — ai-ops-cli@$NEW_VERSION"
