# Phase 5 구현 계획: Doc Impact Reviewer Skill

## Summary

Phase 5는 커밋/완료 시점에 “이번 변경으로 어떤 운영 문서를 갱신해야 하는지” 판단하는 **global task skill**을 추가한다. v1에서는 subagent나 git hook이 아니라 수동 호출 가능한 skill로 시작한다. 이유는 문서 갱신 전 사용자 확인이 필요하고, 실제 편집 범위가 프로젝트마다 달라서 parent agent 흐름 안에서 다루는 편이 안전하기 때문이다.

## Key Changes

- `doc-impact-reviewer` task skill을 global skill catalog에 추가한다.
  - 설치 대상은 기존 skill lifecycle과 동일하게 `AI_OPS_HOME/.agents/skills/doc-impact-reviewer/`다.
  - `--project`, hook, 자동 커밋, 자동 staging은 제공하지 않는다.
  - `allow_implicit_invocation: false`로 두어 사용자가 명시 호출할 때만 동작하게 한다.

- skill workflow는 다음 계약으로 고정한다.
  1. `git status`, `git diff`, 변경 파일 목록을 확인한다.
  2. 프로젝트 운영 레이어가 있으면 `AGENTS.md`, `docs/docs-status.md`, `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`, `doc-update-rules.md`, `impact-checklist.md`, `review-checklist.md`를 읽는다.
  3. 변경을 CLI/API, manifest/schema, pack/specs, skill/subagent catalog, business/domain rule, verification/runtime docs 등으로 분류한다.
  4. 갱신 후보 문서, 근거, 미갱신 리스크를 `required / recommended / not needed`로 보고한다.
  5. 문서 편집 전 사용자 컨펌을 받는다.
  6. 승인된 문서만 수정한다.
  7. 직접 커밋하지 않는다.

- Reserved 문서와 create-only 문서 보호 규칙을 skill 지침에 명시한다.
  - `Reserved` 문서는 명시 승인 없이 사실 문서처럼 승격하지 않는다.
  - 프로젝트 운영자가 소유하는 create-only 문서는 자동 덮어쓰지 않는다.
  - `GEMINI.md`, `CLAUDE.md` adapter에는 canonical 규칙을 복제하지 않는다.

- 문서를 갱신한다.
  - README 계열에 `doc-impact-reviewer` 설치/사용 예시를 추가한다.
  - `apps/cli/data/skills/README.md`에 task skill authoring/usage 항목을 보강한다.
  - `docs/implementation-playbook.md` Phase 5를 실제 skill 이름과 검증 예시 기준으로 정리한다.

## Test Plan

- Registry/schema 검증
  - `doc-impact-reviewer`가 kebab-case id로 등록되는지 확인한다.
  - task skill 필수 파일과 tool metadata가 기존 loader/schema를 통과하는지 확인한다.

- Install smoke
  - temp `AI_OPS_HOME`에서 `ai-ops skill install doc-impact-reviewer --tool codex` 실행.
  - 결과가 global home 아래 `.agents/skills/doc-impact-reviewer/SKILL.md`에만 생성되는지 확인한다.
  - 현재 cwd에 `.agents`, `.ai-ops`, `.codex`, `.claude`, `.gemini`가 새로 생기지 않는지 확인한다.

- Content contract
  - skill 본문에 “diff 확인”, “문서 후보 제안”, “사용자 컨펌 전 편집 금지”, “직접 커밋 금지”, “Reserved 승격 금지”가 포함되는지 확인한다.

- 전체 검증
  - `npm run check`
  - `npm run build`
  - `npm run compile`

## Assumptions

- Phase 5 MVP는 skill만 추가하고 subagent는 만들지 않는다.
- git hook은 v1 범위에서 제외한다.
- skill은 문서 갱신 판단과 승인 후 편집까지 다룰 수 있지만, 커밋과 staging은 사용자가 별도로 요청할 때만 수행한다.
- `capture-review-decisions`는 관련 future helper로 볼 수 있지만, Phase 5의 주 기능으로 통합하지 않는다.
