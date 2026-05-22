# Fix `safe-local` Codex Permission Profile Validation

## Summary

`ai-ops codex-permissions install safe-local` should stop writing a profile that later breaks Codex config loading. The fix is to make the installer reference-backed and runtime-backed: keep the docs constraints as acceptance criteria, but validate the exact generated `config.toml` shape with the installed local `codex` parser before writing it.

Current local finding: `codex-cli 0.130.0` accepts the legacy runtime shape `:project_roots` + `"**/*.env" = "none"` and rejects the docs shape `:workspace_roots` + `"**/*.env" = "deny"`. The implementation must therefore choose a validated syntax, not hard-code one from memory or docs alone.

## Key Changes

- Change `safe-local` profile generation to support validated syntax candidates:
  - Preferred docs candidate: `[permissions.ai-ops-safe-local.filesystem.":workspace_roots"]` with `"**/*.env" = "deny"`.
  - Current runtime fallback: `[permissions.ai-ops-safe-local.filesystem.":project_roots"]` with `"**/*.env" = "none"`.
  - Use the first candidate that passes local Codex config validation.
- Add a runtime config validator for install:
  - Create a temp `CODEX_HOME/config.toml` containing `default_permissions = "ai-ops-safe-local"` and the candidate profile.
  - Run `codex debug models` with temp `HOME` and temp `CODEX_HOME`.
  - Treat exit 0 as parser-compatible; treat config-load errors as candidate failure.
  - If `codex` is unavailable, use the current runtime fallback shape and include a warning in install output.
  - If `codex` is available but no candidate validates, fail closed and do not write `~/.codex/config.toml`.
- Update generated docs/examples/tests to stop asserting one universal syntax. They should say `safe-local` installs a Codex-compatible env-file deny rule and chooses the exact syntax verified against the installed Codex runtime.
- Keep existing conflict behavior: do not mix permission profiles with user-owned `sandbox_mode` / `sandbox_workspace_write`, do not overwrite another `default_permissions`, and do not rewrite user-owned `permissions.ai-ops-safe-local` tables.

## Tests

- Unit-test candidate selection with an injected validator:
  - Docs candidate passes: generated config uses `:workspace_roots` + `deny`.
  - Docs candidate fails and runtime fallback passes: generated config uses `:project_roots` + `none`.
  - All candidates fail: install returns conflict/failure and leaves config unchanged.
  - Validator unavailable: fallback shape is used and status includes a warning.
- Update existing `codex-permissions` unit/e2e assertions to verify behavior, not a single hard-coded env-glob value.
- Add an optional local smoke test skipped when `codex` is missing:
  - Build dist.
  - Install `safe-local` into temp `CODEX_HOME`.
  - Run `codex debug models` against that temp config.
  - Assert exit 0.
- Run verification:
  - `npm run build`
  - `npm test -- apps/cli/src/core/__tests__/codex-permissions.test.ts apps/cli/src/__tests__/e2e.test.ts`
  - local smoke with `codex debug models`
  - `npm run check`
  - `git diff --check`

## Assumptions

- The command remains `ai-ops codex-permissions install safe-local`; no new public CLI flag is added.
- Local Codex runtime behavior wins when it conflicts with `docs/references/codex/`, matching `docs/agent/project-rules/routing-rules.md`.
- The installer may run a lightweight local Codex parser command, but it must not require model access or network.
- Existing unrelated operating-layer document changes in the dirty worktree must be preserved.
