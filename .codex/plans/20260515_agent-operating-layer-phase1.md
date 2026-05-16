# Phase 1 수정 구현 계획: Project Operating Layer MVP

## 요약

`docs/implementation-playbook.md`의 **Phase 1: Project Operating Layer MVP**를 작업 범위로 삼고, 제품 판단 충돌은 `docs/plan.md`를 상위 기준으로 따른다.

이전 Phase 1 계획에서 수정할 점:

- `spec` 명령 제거는 Phase 1 범위가 아니므로 제외한다. root `specs/` 제거와 `docs/specs/` pack은 Phase 4에서 처리한다.
- `skill --project` 제거도 Phase 2 범위이므로 Phase 1에서는 건드리지 않는다.
- Phase 1은 `init/update/diff/uninstall/audit`의 project operating layer 전환에만 집중한다.

## 구현 변경

- CLI 표면
  - `ai-ops init`은 project operating layer를 설치한다.
  - `ai-ops audit`을 추가한다.
  - `ai-ops update/diff/uninstall`은 새 `.ai-ops/manifest.json` 기준으로 동작한다.
  - `init --tool <tool...>`을 지원한다. 없으면 기존처럼 프롬프트를 띄운다.
  - `uninstall --yes`를 추가해 임시 디렉터리 e2e 검증을 자동화할 수 있게 한다.
  - `--cwd`는 추가하지 않는다. 테스트는 command `workdir`를 바꿔 실행한다.

- 설치 파일
  - `AGENTS.md`는 항상 생성하며 canonical entrypoint로 둔다.
  - `GEMINI.md`는 `gemini`가 선택된 경우 생성하는 adapter다.
  - `CLAUDE.md`는 `claude-code`가 선택된 경우 생성하는 adapter다.
  - 프롬프트 기본 선택은 세 도구 전체로 둔다.
  - `docs/agent/*`, `docs/business/*`, `docs/docs-status.md`를 생성한다.
  - `docs/agent/AGENTS.md`는 만들지 않는다.

- 템플릿 source
  - 새 데이터 루트: `apps/cli/data/context-layer/`
  - template은 frontmatter를 포함한다.
  - `workflow`, `rules`, `checks`는 기본 `Active`.
  - `codebase-map`, `business-rules`는 기본 `Reserved`.
  - `Reserved` 문서에는 판단 근거로 사용하지 말라는 문구를 넣는다.

- 상태 파일
  - 새 manifest 경로: `.ai-ops/manifest.json`
  - 새 context index 경로: `.ai-ops/context-layer.json`
  - old `.ai-ops-manifest.json`는 읽지 않고 마이그레이션하지 않는다.
  - manifest에는 `schemaVersion`, `kind: project-operating-layer`, `tools`, `managed_files`, `project_files`, `settings`, `sourceHash`, `cliVersion`, `generatedAt`을 기록한다.
  - context-layer index에는 각 문서의 `path`, `status`, `layer`, `owner`, `read_when`, `update_when`, `contentHash`를 기록한다.

- 파일 보존 정책
  - root entrypoint와 `docs/agent`의 공통 운영 문서는 `ai-ops` managed section으로 갱신한다.
  - `docs/docs-status.md`, `docs/agent/maps/codebase-map.md`, `docs/business/business-rules.md`는 project-owned create-only 파일로 둔다.
  - update는 create-only 파일이 없을 때만 다시 만든다.
  - uninstall은 create-only 파일이 설치 당시 템플릿과 동일하면 삭제하고, 수정되어 있으면 보존한다.
  - managed section 제거 후 사용자 내용이 남는 파일은 삭제하지 않는다.

- 명령 동작
  - `diff`: manifest, context-layer, 실제 파일 존재 여부, managed template sourceHash drift를 보고한다.
  - `update`: managed section을 최신 template으로 갱신하고, 누락된 create-only 파일만 복구하며, context-layer index를 다시 쓴다.
  - `audit`: frontmatter, `docs/docs-status.md`, manifest, context-layer, 실제 파일의 불일치를 읽기 전용으로 보고한다.
  - `uninstall`: project operating layer와 `.ai-ops/*`만 처리하고 global skills/subagents는 건드리지 않는다.

## 테스트 계획

- schema/unit
  - 새 manifest schema와 context-layer schema 검증.
  - old `.ai-ops-manifest.json`가 있어도 새 manifest reader가 사용하지 않는지 확인.
  - template frontmatter parsing과 `Active`/`Reserved` 상태 검증.

- install/update/diff/audit/uninstall
  - `init --tool codex`는 `AGENTS.md`와 docs layer만 생성한다.
  - `init --tool codex --tool gemini --tool claude-code`는 세 root entrypoint를 모두 생성한다.
  - `update`는 managed section만 교체하고 project-owned 파일 내용을 덮어쓰지 않는다.
  - `diff`는 누락 파일과 template sourceHash drift를 감지한다.
  - `audit`은 frontmatter/docs-status/context-layer 불일치를 읽기 전용으로 보고한다.
  - `uninstall --yes`는 unmodified create-only 파일을 삭제하고 modified project-owned 파일은 보존한다.

- e2e
  - 임시 디렉터리에서 `init → diff → audit → update → uninstall --yes`.
  - `npm run check`, `npm run build`, `npm run compile`.
  - 실제 기존 프로젝트 재설치는 수행하지 않는다.

## 가정과 기본값

- Phase 1에서는 monorepo workspace override를 구현하지 않는다.
- Phase 1에서는 skills/subagents lifecycle을 수정하지 않는다.
- Phase 1에서는 `spec` 명령과 root `specs/` 동작을 제거하지 않는다.
- adapter 생성은 선택된 tool 기준이지만, interactive 기본 선택은 모든 tool이다.
- `docs/plan.md`와 `docs/implementation-playbook.md`가 충돌하면 `docs/plan.md`를 우선한다.
