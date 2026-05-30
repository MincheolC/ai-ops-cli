# `code-review-gate` Global Integration 구현 계획

## Summary

`ai-ops integration install code-review-gate`로 Codex 전용 read-only AI 리뷰 게이트를 global runtime에 설치한다. v1은 자동 hook 없이 사용자가 명시적으로 요청할 때만 동작한다. `code-review-gate` subagent는 Fine 7 task skills를 묶어 current diff, HEAD commit, plan-vs-implementation, project-wide, feature, module review 요청을 모두 처리한다.

## Key Changes

### Phase 1: Integration Lifecycle 확장

- `integration` component model에 `subagent` 타입을 추가하고, hook/receipt 없는 integration을 허용한다.
- `code-review-gate` integration id를 추가한다.
- `integration install/status/uninstall`이 여러 `skill`, 여러 `subagent`, optional `codex-hook`, optional `receipt-config`를 처리하게 바꾼다.
- `integration diff [integrationId]`, `integration update [integrationId]`를 추가한다.
- Hook 없는 integration은 `CODEX_HOME`, `hooks.json`, hook trust hint를 요구하거나 출력하지 않는다.
- 기존 `context-promotion`, `pc` 동작과 shared hook behavior는 유지한다.

### Phase 2: Review Gate Assets 추가

- Codex-only task skills 7개를 추가한다.
  - `code-review-scope-map`: 요청 문장을 review target으로 정규화하고 blast radius를 만든다.
  - `code-review-correctness`: 요구사항, business invariant, compatibility, edge case를 본다.
  - `code-review-security`: auth/authz, ownership, token/session, secret/PII, rate limit을 본다.
  - `code-review-state-concurrency`: async, retry, idempotency, transaction, stale state를 본다.
  - `code-review-test-quality`: missing tests, weak mocks, suspicious test changes를 본다.
  - `code-review-architecture-ops`: structure erosion, migration, perf, rollout/rollback, observability를 본다.
  - `code-review-final-gate`: findings를 dedupe하고 Codex 내장 리뷰 포맷으로 출력한다.
- 모든 review task skill은 `agents/openai.yaml`에서 `allow_implicit_invocation: false`로 둔다.
- `code-review-gate` subagent를 추가한다.
  - `supported_tools: ["codex"]`
  - `sandbox_mode = "read-only"`
  - `skill_names`는 위 7개 skill 전체
  - loader 제약 때문에 Claude/Gemini frontmatter 파일은 최소 유효 파일로 함께 둔다.
- `integration-registry.json`에 `code-review-gate`를 추가한다.
  - components: 7개 skill + 1개 subagent
  - hooks/receipts 없음

### Phase 3: Review Target Protocol

- `code-review-scope-map`은 사용자 요청을 아래 target 중 하나로 분류한다.
  - `plan_current_changes`: “현재 변경사항은 [계획 문서] 구현” 요청. 계획 문서, staged/unstaged/untracked diff를 비교한다.
  - `plan_head_commit`: “직전 커밋은 [계획 문서] 구현” 요청. 계획 문서와 `HEAD` commit diff를 비교한다.
  - `project_wide`: “이 프로젝트 전체” 요청. diff 기반이 아니라 repo 전체의 entrypoint/config/domain/test surface를 우선순위로 훑는 audit로 처리한다.
  - `feature`: “A 기능” 요청. feature name을 routes/modules/docs/tests/file names에서 찾아 review slice를 구성한다.
  - `module`: “B 모듈” 요청. explicit path가 있으면 path를 우선하고, 없으면 module/package/directory/symbol 검색으로 review slice를 구성한다.
  - `diff_default`: target이 없으면 staged/unstaged/untracked current worktree 전체를 리뷰한다.
- Target이 여러 후보로 갈리면 deep review를 진행하지 않고 `**Findings**`에는 심각한 이슈 없음 또는 target ambiguity를 짧게 말하고, `**검증**`의 남은 확인에 필요한 구체 후보를 남긴다.
- Project-wide review는 “완전성 보장”을 주장하지 않는다. scope-map이 탐색한 surfaces와 제외된 surfaces를 `**검증**`에 남긴다.
- Feature/module review는 target slice 밖 변경은 finding으로 올리지 않는다. 단, target과 직접 연결된 shared policy/auth/schema/test helper는 포함한다.

### Phase 4: Final Review Contract, Docs, Validation

- `code-review-final-gate`의 최종 출력은 Codex 내장 리뷰 스타일로 고정한다.
  - `**Findings**`
  - 0개 이상의 `[P0]`/`[P1]`/`[P2]`/`[P3]` finding 문단
  - `**검증**`
  - finding 수는 고정하지 않는다.
  - 검증 항목은 npm에 한정하지 않는다.
  - `통과:`에는 직접 확인한 검증만 쓴다.
  - `미실행/남은 확인:`에는 merge 전에 필요한데 아직 증거가 없는 항목만 쓴다.
- README/README.ko와 implementation guide를 갱신한다.
- Studio runtime snapshot/list tests는 새 integration/subagent가 보이는 방향으로 갱신한다.

## Test Plan

- Unit/schema:
  - integration catalog가 `subagent` component와 hook 없는 `code-review-gate`를 허용한다.
  - 기존 `context-promotion`, `pc` catalog/manifest가 계속 통과한다.
  - subagent install plan이 `code-review-gate` Codex TOML에 7개 skill config를 렌더링한다.
- Command/e2e:
  - temp `AI_OPS_HOME`에서 `integration install code-review-gate`가 7개 skills와 `.codex/agents/code-review-gate.toml`만 설치한다.
  - `list/status/diff/update/uninstall`이 code-review-gate와 기존 integrations 모두에서 동작한다.
  - hook 없는 code-review-gate install/status가 `CODEX_HOME`과 hook trust를 요구하지 않는다.
  - uninstall은 owned skill/subagent만 제거하고 pre-existing manual install은 보존한다.
- Skill contract checks:
  - review skills는 explicit-only metadata를 가진다.
  - scope-map skill은 6개 target mode를 모두 문서화한다.
  - final-gate skill에는 `**Findings**`, severity tags, `**검증**`, 직접 검증/미실행 구분 규칙이 포함된다.
- Validation commands:
  - `npm run check`
  - `npm run build --workspace=apps/cli`
  - targeted e2e tests for integration/subagent/skill lifecycle
  - `git diff --check`

## Assumptions

- v1은 Codex-only다.
- v1은 자동 hook/auto-review/PR automation을 포함하지 않는다.
- `integration diff/update`는 이번 범위에 포함한다.
- Fine 7 skill 구성을 확정한다.
- 각 phase는 별도 구현/리뷰/검증/커밋 단위로 진행한다.
