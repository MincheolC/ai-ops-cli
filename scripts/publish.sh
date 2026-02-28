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
npm version "$BUMP" --no-git-tag-version --workspace=packages/compiler
npm version "$BUMP" --no-git-tag-version --workspace=apps/cli

NEW_VERSION=$(node -p "require('./packages/compiler/package.json').version")
echo "▶ Bumped to v$NEW_VERSION"

# ── 3. git commit + tag ───────────────────────────────────────────────────────
git add packages/compiler/package.json apps/cli/package.json
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# ── 4. OTP prompt ─────────────────────────────────────────────────────────────
echo ""
read -rp "npm OTP (2FA code, or Enter to skip): " OTP
OTP_FLAG=""
if [[ -n "$OTP" ]]; then
  OTP_FLAG="--otp=$OTP"
fi

# ── 5. publish (compiler → cli) ───────────────────────────────────────────────
echo "▶ Publishing ai-ops-compiler@$NEW_VERSION..."
npm publish --workspace=packages/compiler $OTP_FLAG

echo "▶ Publishing ai-ops-cli@$NEW_VERSION..."
npm publish --workspace=apps/cli $OTP_FLAG

# ── 6. push ───────────────────────────────────────────────────────────────────
echo ""
read -rp "Push commit + tag to origin? [y/N] " PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  git push && git push --tags
  echo "✓ Pushed v$NEW_VERSION"
fi

echo "✓ Done — ai-ops-compiler@$NEW_VERSION, ai-ops-cli@$NEW_VERSION"
