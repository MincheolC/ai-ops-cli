# Codex Permissions Installer v2 계획

## Summary

`safe-local`을 기존 `sandbox_mode + writable_roots + PermissionRequest hook` 방식에서 permission profile 기반으로 완전 교체한다. 아직 설치된 곳이 없다는 전제에 따라 새 명령명을 만들지 않고 기존 `ai-ops codex-permissions install|status|uninstall safe-local` 표면을 유지한다.

v2 목표는 세 가지다.

- `pc`/context repo인 `~/.personal-project-contexts` 전체 write 허용
- Codex가 실행되는 모든 workspace root에서 `.codex/plans` write 허용
- ai-coding worker는 user/global 설정에 의존하지 않는 `codex exec` run-scoped profile 가이드를 README에 제공

## Key Changes

- `config.toml` 관리를 permission profile 중심으로 변경한다.
  - `default_permissions = "ai-ops-safe-local"`과 `[permissions.ai-ops-safe-local]` managed block을 user-level `~/.codex/config.toml`에 upsert한다.
  - profile은 `:minimal = "read"`, `~/.personal-project-contexts = "write"`, `${AI_OPS_HOME ?? HOME}/.ai-ops/context-promotion = "write"`를 부여한다.
  - `[permissions.ai-ops-safe-local.filesystem.":project_roots"]`는 `"." = "write"`, `".git" = "read"`, `".codex" = "read"`, `".codex/plans" = "write"`, `"**/*.env" = "none"`으로 둔다.
  - `[permissions.ai-ops-safe-local.network] enabled = false`로 시작한다.
  - user-owned `sandbox_mode`/`sandbox_workspace_write`가 있으면 profile이 무시되므로 conflict로 fail-closed한다.
  - 기존 ai-ops v1 managed `sandbox_mode`/`writable_roots` block만 있으면 제거하고 v2 profile block으로 교체한다.

- `PermissionRequest` hook은 주 경로에서 제거한다.
  - install은 더 이상 `~/.codex/hooks.json`에 `PermissionRequest` hook을 추가하지 않는다.
  - uninstall/install은 기존 ai-ops managed `codex-permissions hook permission-request safe-local` hook이 있으면 cleanup한다.
  - CLI의 old hook runner는 hidden no-op compatibility command로 한 릴리스 남긴다.

- `rules/default.rules`는 command 예외가 필요할 때만 사용한다.
  - v2 기본 install은 기존 v1 managed allow block을 제거한다.
  - `pc` context repo git 작업은 absolute path write profile로 처리하고, product repo `git commit`은 `.git = "read"` 때문에 Codex 안에서는 승인 없이 수행되지 않게 둔다.
  - worker의 `git push`/`gh pr create`는 Codex가 아니라 orchestrator가 실행하므로 user rules에 의존하지 않는다.

- README/README.ko와 CLI README 쌍에 worker 가이드를 추가한다.
  - worker는 `codex exec --ignore-user-config --ignore-rules --cd "$WORKTREE"`를 기본으로 사용한다.
  - planner/review Codex는 `default_permissions=":read-only"`와 `approval_policy="never"`를 사용한다.
  - implementation/fix Codex는 run-scoped `ai-worker-impl` profile을 `-c`로 주입하고, worktree write + `.git` read + `.codex/plans` write + env deny + network disabled를 명시한다.
  - Codex 실행 후 orchestrator가 HEAD/ref/changed-file scope를 검사하고, commit/push/PR 생성은 Codex 밖에서 수행해야 한다고 문서화한다.

## Test Plan

- Unit tests
  - absent config에 v2 profile block이 생성되고 재실행이 idempotent인지 검증
  - user-owned `sandbox_mode`, `sandbox_workspace_write`, 다른 `default_permissions`는 conflict로 파일을 쓰지 않는지 검증
  - v1 managed config/rules/hook cleanup 후 v2 profile로 전환되는지 검증
  - uninstall이 v2 profile block과 legacy hook/rules만 제거하고 사용자 설정은 보존하는지 검증

- E2E tests
  - temp `HOME`, `AI_OPS_HOME`, `CODEX_HOME`에서 `install`, 재실행, `status`, `uninstall` 검증
  - install 결과에 `sandbox_mode`와 `PermissionRequest` hook이 없고 `default_permissions = "ai-ops-safe-local"`이 있는지 검증
  - README worker guide에 `--ignore-user-config`, `--ignore-rules`, `approval_policy="never"`, `.codex/plans`, `.git = read`, orchestrator commit/push/PR 원칙이 포함되는지 검증

- Validation
  - `npm run build --workspace=apps/cli`
  - `npm test`

## Assumptions

- 기존 `safe-local`은 아직 배포/설치된 곳이 없으므로 command name은 유지하고 behavior는 v2로 완전 교체한다.
- v2는 `sandbox_mode`와 permission profile을 섞지 않는다.
- worker guide는 installer README 문서에 추가하고, worker 전용 installer subcommand는 이번 범위에 추가하지 않는다.
- worker의 network/API 작업은 orchestrator 프로세스가 담당하고, Codex subprocess는 sandboxed file edit/review만 담당한다.
