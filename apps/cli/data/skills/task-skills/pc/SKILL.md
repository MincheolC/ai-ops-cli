---
name: pc
description: Use only when the user explicitly invokes $pc, $pc:help, $pc:init, $pc:add, $pc:todo, $pc:do, or $pc:done for personal workspace/repo/service context loading, task intake, active workstream selection, and handoff.
disable-model-invocation: true
---

# pc

개인 workspace 컨텍스트를 `~/.personal-project-contexts/`에 보관하고, 현재 경로와 매칭해 작업 시작/착수/종료 맥락을 수동으로 불러오는 skill이다. 단일 repo, monorepo, monorepo-like, git이 없는 MSA folder 묶음을 모두 workspace로 다룬다.

## Invocation

- 이 skill은 사용자가 `$pc`, `$pc:help`, `$pc:init`, `$pc:add`, `$pc:todo`, `$pc:do`, `$pc:done`을 명시했을 때만 사용한다.
- `$pc`는 `$pc:todo`와 동일하게 처리한다.
- 알 수 없는 subcommand는 파일을 수정하지 말고 `$pc:help` 형식으로 사용법을 안내한다.
- 모든 사용자-facing 응답은 한국어로 작성한다. 파일 경로, command, code identifier는 원문을 유지한다.

## Language Rules

- context repo에 생성/갱신하는 Markdown 산출물은 한국어를 기본으로 쓴다.
- Markdown 제목과 필드 라벨도 한국어로 쓴다. 예: `## 식별`, `- 워크스페이스 ID:`, `## 현재 방향`.
- 고유명사, 전문 용어, repo 이름, 파일 경로, branch, package/library/service name, API field, command, protocol은 원문을 유지한다.
- `git-repo`, `monorepo-package`, `folder-service`, `git`, `none` 같은 enum 값은 원문을 유지한다.
- 외부 문서에서 가져온 고유 명칭은 무리하게 번역하지 말고, 설명 문장만 한국어로 요약한다.

## Context Store

```txt
~/.personal-project-contexts/
  workspaces/
    <workspace-id>/
      workspace-state.md
      backlog.md
      repos/
        <entry-id>.md
      workstreams/
        <workstream-slug>.md
  daily/
    YYYY-MM-DD.md
```

- 기본 저장소 경로는 `~/.personal-project-contexts/`로 고정한다.
- `workspaces/<workspace-id>/`는 제품/도메인/작업 묶음의 장기 맥락을 담는다.
- `repos/<entry-id>.md`는 이름은 `repos`지만 git repo, monorepo package, git 없는 folder service를 모두 기록하는 entry 파일이다.
- `workstreams/*.md`가 실제 로딩/언로딩 단위이며, `범위` 섹션에 영향 entry를 명시한다.
- `backlog.md`는 느슨한 할 일 inbox가 아니라 등록된 workstream의 상태 index다.
- 자세한 파일 양식이 필요하면 [references/templates.md](references/templates.md)를 읽는다.

## Path Rules

- `$pc:init [--reset] [path...]`의 path는 상대경로, 절대경로, `~` 경로를 허용한다.
- 인자가 없으면 `$pc:init .`와 동일하게 처리한다.
- 상대경로는 현재 작업 디렉터리 기준으로 해석하고, 저장할 때는 absolute path로 normalize한다.
- 존재하지 않는 path는 생성하지 않는다. 어떤 파일도 수정하지 말고 존재하지 않는 path를 알려준다.
- monorepo-like sibling repo/service를 이름만 보고 무작정 흡수하지 않는다.
- 단, `$pc:init .` 대상 folder 안에 `WORKSPACE_CODE_MAP.md`, child `.git`, `package.json`, `pubspec.yaml`, `pyproject.toml`, `go.mod`, `Cargo.toml` 같은 강한 증거가 있으면 evidence-based discovery로 entry 후보를 등록한다.

## Bootstrap Discovery

`$pc:init`은 빈 템플릿 생성이 아니라 첫 재진입에 쓸 수 있는 context bootstrap이다. 쓰기 전에 다음을 먼저 읽고 요약한다.

- workspace root의 `WORKSPACE_CODE_MAP.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.codex/plans/*.md`, `specs/*.md`
- 명시 path와 강한 후보 child directory의 repo metadata: `.git`, remote URL, default branch
- stack/command manifest: `package.json`, `pubspec.yaml`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, `justfile`
- product/spec hints: `docs/`, `specs/`, `frontend/`, `api/`, `lib/`, `apps/`, `packages/`

Discovery quality floor:

- `Overview`에는 generic 문장 대신 workspace가 무엇을 만드는지와 주요 surface를 적는다.
- `Entries`에는 강한 증거가 있는 child repo/service를 등록한다. 예: child `.git` repo, workspace map에 명시된 repo, manifest가 있는 app/API folder.
- git 없는 parent folder에 강한 child entry가 있으면 parent는 보통 container로만 쓰고, 단일 `folder-service` entry로 대체하지 않는다.
- `현재 방향`, `엔트리 간 주의사항`, `공통 명령`, entry별 `기술 스택`/`명령`은 읽은 evidence에서 채운다.
- 충분한 evidence가 있는데도 비어 있는 placeholder를 남기지 않는다. 정말 알 수 없을 때만 빈 값으로 두고, 어떤 evidence가 부족했는지 `Notes`에 남긴다.
- discovery 결과가 애매하면 쓰기 전에 후보 entries와 근거를 짧게 보여주고 확인을 요청한다.

## Existing Context Refresh

이미 workspace context가 있을 때 `$pc:init [path...]`를 다시 실행하면 no-op이 아니라 evidence refresh로 처리한다.

- `backlog.md`, `workstreams/`, `daily/`, 사용자 handoff 기록은 보존한다.
- 누락된 child entries를 새로 추가한다.
- 기존 entry가 명백히 잘못된 bootstrap 산출물인 경우 보정한다. 예: git 없는 parent folder가 단일 `folder-service`로 등록됐지만, `WORKSPACE_CODE_MAP.md`나 child `.git` repo가 강한 child entries를 가리키는 경우.
- generic placeholder 문장만 evidence 기반 한국어 문장으로 교체한다. 예: `Personal workspace context for ...`, "현재 구체적인 active workstream은 아직..." 같은 초기 filler.
- 이전 템플릿으로 생성된 영어 Markdown 제목과 필드 라벨은 한국어로 정규화한다. 사용자 내용, 고유명사, 전문 용어, command, path, enum 값은 보존한다.
- 사용자가 직접 쓴 결정, 주의사항, handoff, backlog 항목은 삭제하지 않는다.
- full reset은 사용자가 명시적으로 요청하거나 `$pc:init --reset [path...]`를 쓴 경우에만 한다. reset 전에는 기존 `workspaces/<workspace-id>/`를 context repo 안의 `backups/<timestamp>-<workspace-id>/`로 복사한 뒤 진행한다.

## Workspace and Entry Detection

- workspace root:
  - path가 하나면, 해당 path가 git repo 안에 있을 때 git root를 workspace root로 쓰고, git repo가 아니면 해당 folder를 workspace root로 쓴다.
  - path가 여러 개이고 모두 같은 git root 안에 있으면 그 git root를 workspace root로 쓴다.
  - path가 여러 개이고 서로 다른 git root 또는 git 없는 folder를 가리키면, 현재 작업 디렉터리가 모든 path의 ancestor일 때 현재 작업 디렉터리를 workspace root로 쓰고, 아니면 공통 ancestor를 쓴다.
- workspace id는 workspace root basename을 slug로 만들고, 충돌하면 remote owner/repo 또는 짧은 path hash를 덧붙인다.
- entry id는 entry path basename을 slug로 만들고, 충돌하면 상위 폴더 slug를 덧붙인다.
- entry type:
  - `git-repo`: entry path가 git root와 같을 때
  - `monorepo-package`: entry path가 git root 아래의 명시 path일 때
  - `folder-service`: entry path가 git repo 밖의 folder일 때
- git 없는 workspace root 아래에 여러 강한 child entry가 있으면 workspace root 자체를 `folder-service`로 등록하지 말고, child entries를 등록한다.
- `monorepo-package`는 `VCS: git`, `Git Root: <workspace-git-root>`를 기록한다.
- `folder-service`는 `VCS: none`으로 기록하고 git command를 요구하지 않는다.

## Matching Rules

- 현재 absolute path로 `workspaces/*/workspace-state.md`의 `Workspace Root` ancestor match를 찾는다.
- 그 안에서 `repos/*.md`의 `Path` 또는 `Git Root` 중 현재 path를 가장 구체적으로 포함하는 entry를 current entry로 고른다.
- 여러 workspace가 동시에 매칭되면 가장 긴 `Workspace Root`를 우선한다.
- 동률이거나 애매하면 read-only 명령은 후보를 보여주고, 쓰기 명령은 파일을 수정하지 말고 사용자가 workspace를 더 명확히 지정하게 한다.

## Workstream Lifecycle

workstream이 이 skill의 핵심 작업 단위다.

- `$pc:add <항목>`은 새 workstream을 등록한다.
- `$pc:todo`는 read-only로 진행중/미완료 workstream들을 보여준다.
- `$pc:do <항목>`은 등록된 workstream을 진행중으로 전환하거나 오늘 진행 대상으로 갱신한다.
- `$pc:done`은 진행중 workstream의 오늘 진행 상황, 완료 여부, 남은 일, 다음 첫 행동을 기록한다.
- workstream 상태는 `Planned`, `Active`, `Paused`, `Done` 중 하나를 기본으로 쓴다.
- `backlog.md`는 `Planned`, `Active`, `Paused`, `Done` workstream을 찾기 위한 얇은 index이며, 상세 맥락은 `workstreams/<slug>.md`에 둔다.
- git 기반 entry는 workstream에 마지막 확인 commit hash를 기록해 다음 `$pc:done`에서 incremental handoff를 만들 수 있게 한다.

## Next Action Quality Rules

`다음 첫 행동`은 오래된 메모를 그대로 복사하지 말고, 매번 현재 evidence로 재검증한다.

- source of truth 우선순위는 사용자 제공 완료/남은 일/다음 행동, 새 commit/diff evidence, 참조 문서의 phase/scope, 실제 파일/manifest 상태, 기존 workstream 메모 순서다.
- `남은 일`이나 기존 `다음 첫 행동`에 있는 항목이라도 이미 완료됐거나 현재 phase의 제외 범위에 있으면 다음 행동으로 쓰지 않는다.
- 참조 문서가 `Phase N`, `포함`, `제외`, `완료 기준`을 명시하면 그 경계를 반영한다. 사용자가 "Phase N까지 완료"라고 말했으면 다음 행동은 Phase N 내부의 오래된 task가 아니라 다음 미완료 phase나 검증/정리 행동에서 고른다.
- 특정 파일/테스트를 다음 행동으로 제안하기 전에 `rg --files`, manifest, 현재 코드 구조로 그 파일/테스트/스크립트가 이미 있는지 확인한다.
- repo에 test runner나 script가 없는데 "unit test 추가"처럼 단정하지 않는다. 먼저 "검증 방식 결정" 또는 "작은 검증 스크립트 추가"처럼 실제 repo 상태에 맞는 행동으로 쓴다.
- evidence가 엇갈리면 단정하지 말고 `추정`임을 표시하고, 어떤 확인이 필요한지 함께 남긴다.
- `$pc:todo`는 read-only이므로 stale한 `다음 첫 행동`을 발견하면 파일을 고치지 않고 응답에서 보정해 말한다.

## Workstream Intake Compression

사용자가 `$pc:add <제목>`와 함께 긴 계획서, sprint 문서, POC 설계서, phase 목록, 테스트 계획을 붙여넣거나 `@mention`으로 문서를 제공하면 workstream 초기 본문으로 압축한다.

- 이미 목표/범위/phase/테스트/성공 기준이 있는 문서는 `$pc:add` 입력으로 본다.
- 원문 전체를 그대로 저장하지 않는다. 재진입에 필요한 운영 맥락으로 압축한다.
- `@mention` 또는 파일 경로로 제공된 문서는 `참조 문서` 섹션에 문서명, absolute path, 역할을 기록한다.
- 채팅에만 붙여넣은 원문은 `참조 문서`에 `사용자 제공 계획서`, `경로: none`으로 기록한다.
- `목표`에는 workstream의 핵심 질문과 완료 기준을 2-5문장으로 요약한다.
- `범위`에는 관련 entries를 기록한다. 문서에 명시된 파일 경로, package, API route, dashboard, client surface를 보고 추론하되 애매하면 current entry를 기본값으로 둔다.
- `현재 상태`에는 완료된 phase, 이미 존재하는 기반, 현재 branch/작업 상태를 요약한다.
- `남은 일`에는 곧 작업할 phase를 체크리스트로 변환한다.
- `다음 첫 행동`은 바로 실행 가능한 하나의 행동으로 좁히고, `Next Action Quality Rules`에 맞게 참조 문서의 phase/scope와 실제 repo 상태를 확인한다.
- `열린 질문`에는 구현 전 확인이 필요한 모호점만 남긴다.
- `메모`에는 PII, 보안, 배포 금지, dashboard 노출 제한, 제외 범위 같은 작업 중 잊으면 안 되는 제약을 남긴다.
- `backlog.md`에는 workstream title, status, 범위 entries, workstream file path만 요약한다.

## Safety Rules

- 작업 workspace/repo/service 안에는 이 skill의 context 파일을 만들거나 수정하지 않는다.
- `$pc:help`와 `$pc:todo`는 read-only다. 어떤 파일도 수정하지 않는다.
- `$pc:init`, `$pc:add`, `$pc:do`, `$pc:done`은 `~/.personal-project-contexts/`만 수정한다.
- `$pc:done` handoff 반영을 위해 임시 JS 파일, inline `node --input-type=module -e ...`, ad-hoc markdown replace script를 만들지 않는다.
- `$pc:done`은 `ai-ops pc done draft`로 JSON draft를 만들고, AI 작성 필드는 `ai-ops pc done fill --draft <draft-path> ... --apply`로 채운다.
- Codex가 draft JSON을 직접 편집하면 앱이 patch 적용 여부를 물을 수 있으므로, `fill` 명령으로 표현할 수 있는 handoff는 draft JSON 파일을 직접 수정하지 않는다.
- context store를 수정한 뒤에는 해당 context repo에서만 commit한다.
- 기존 context 파일의 사용자 기록을 삭제하지 않는다. 상태 변경은 append 또는 좁은 섹션 갱신으로 처리한다.
- 작업 repo의 변경을 stage/commit/revert하지 않는다.

## Command Workflow

### `$pc:help`

사용 가능한 subcommand와 사용 시점을 짧게 출력한다.

- `$pc` / `$pc:todo`: 현재 workspace 맥락과 다음 행동 확인
- `$pc:init [--reset] [path...]`: 현재 또는 명시 path를 workspace entry로 등록하거나 재생성
- `$pc:add <항목>`: 새 workstream을 등록하고 큰 계획 문서는 초기 본문으로 압축
- `$pc:do <항목>`: 등록된 workstream을 진행중으로 설정하거나 오늘 작업 대상으로 갱신
- `$pc:done`: 진행중 workstream의 진행/완료/handoff를 저장

CLI help가 필요하면 `ai-ops pc --help`와 `ai-ops pc done --help`를 먼저 확인한다.

### `$pc:init [--reset] [path...]`

1. path 인자가 없으면 `.`를 사용한다. `--reset`은 path로 보지 않는다.
2. 모든 path를 normalize하고 존재 여부를 확인한다.
3. `Bootstrap Discovery` 규칙으로 workspace map, docs, manifests, child repo/service 후보를 읽는다.
4. workspace root와 entry 목록을 `Workspace and Entry Detection` 규칙으로 정한다.
5. `~/.personal-project-contexts/`가 없으면 만들고 git repo로 초기화한다.
6. `workspaces/<workspace-id>/workspace-state.md`, `backlog.md`, `repos/`, `workstreams/`, root-level `daily/`를 만든다.
7. 기존 workspace가 있고 `--reset`이 없으면 `Existing Context Refresh` 규칙에 따라 보존/보정한다.
8. 기존 workspace가 있고 `--reset`이 있으면 `backups/<timestamp>-<workspace-id>/`에 백업한 뒤 workspace를 evidence 기반으로 다시 만든다.
9. 각 entry의 `repos/<entry-id>.md`를 evidence 기반 한국어로 채우거나, 이미 있으면 비어 있거나 generic인 주요 섹션만 보강한다.
10. 사용자의 현재 목표가 대화에서 명확하면 첫 workstream을 만들고 `workspace-state.md`에 active로 등록한다. 불명확하면 active workstream을 비워둔다.
11. context repo에서 변경을 commit한다.

초기화 후에는 workspace id, workspace root, 등록 entry, git 없는 entry 여부, 다음 추천 명령을 짧게 보고한다.

### `$pc:add <항목>`

1. 현재 경로와 매칭되는 workspace를 찾는다. 없으면 `$pc:init .`부터 필요하다고 안내하고 쓰지 않는다.
2. 항목을 workstream title로 보고 `workstreams/<slug>.md`를 만든다. 이미 같은 workstream이 있으면 새 파일을 만들지 말고 기존 파일을 보강한다.
3. 긴 계획서, phase 목록, 테스트 계획, `@mention` 문서가 함께 제공되면 `Workstream Intake Compression` 규칙으로 초기 본문과 참조 문서를 작성한다.
4. 문서가 짧으면 목표, 범위, 현재 상태, 남은 일, 다음 첫 행동을 가능한 만큼 채우고 모르는 값은 비워두지 말고 `열린 질문`에 남긴다.
5. 기본 상태는 `Planned`다. 사용자가 "바로 진행중으로 등록"처럼 명시하면 `Active`로 두고 `workspace-state.md`의 active workstream도 갱신한다.
6. 영향 entry가 명확하면 workstream `범위`와 `backlog.md` index의 `후보 엔트리`에 남긴다.
7. `backlog.md`에는 workstream title, status, 범위 entries, workstream file path만 요약해 등록한다.
8. context repo에서 commit한다.

응답에는 등록된 workstream, 상태, 범위 entries, 참조 문서, 다음 추천 명령을 포함한다.

### `$pc:todo`

read-only로 현재 작업 맥락을 출력한다.

1. 현재 경로와 매칭되는 workspace와 current entry를 찾는다.
2. `workspace-state.md`를 얇게 읽는다.
3. current entry가 있으면 해당 `repos/<entry-id>.md`를 읽는다.
4. `backlog.md`에서 `Active`, `Planned`, `Paused` workstream index를 읽는다.
5. active workstream과 current entry에 관련된 미완료 workstream을 깊게 읽는다.
6. active workstream의 `참조 문서`, `남은 일`, `제외 범위`, `마지막 Handoff`, 현재 repo의 파일/manifest 상태를 대조해 `다음 첫 행동`이 아직 유효한지 확인한다.
7. 아래 순서로 짧게 정리한다.
   - workspace 개요
   - 현재 repo/service 맥락
   - 진행중 workstream
   - 미완료 workstream
   - 각 workstream의 남은 일
   - 첫 번째 행동
   - 첫 번째 행동의 근거 또는 보정 이유

context가 없으면 파일을 만들지 말고 `$pc:init .` 또는 `$pc:init ./admin ./api` 같은 예시를 제안한다.

### `$pc:do <항목>`

1. 현재 경로와 매칭되는 workspace를 찾는다. 없으면 쓰지 않고 `$pc:init .`을 제안한다.
2. `<항목>`과 가장 잘 맞는 기존 workstream을 찾는다.
3. workstream이 없으면 파일을 수정하지 말고 `$pc:add <항목>`으로 먼저 등록하라고 안내한다.
4. 선택한 workstream 상태를 `Active`로 바꾸고 `workspace-state.md`의 active workstream으로 설정한다.
5. 같은 workspace에 기존 active workstream이 있으면 사용자가 명시하지 않은 한 `Paused`로 바꾸거나, 애매하면 확인을 요청한다.
6. workstream의 `오늘`, `현재 상태`, `다음 첫 행동`을 갱신한다.
7. `backlog.md` index의 status를 함께 갱신한다.
8. context repo에서 commit한다.

응답에는 active workstream, 범위 entries, 오늘 목표, 다음 첫 행동을 포함한다.

### `$pc:done`

1. 현재 경로와 매칭되는 workspace와 active workstream을 찾는다. 없으면 쓰지 않고 `$pc:do <항목>`으로 진행중 workstream을 먼저 선택하라고 안내한다.
2. `ai-ops pc status`로 현재 cwd 기준 workspace/workstream/current entry readiness와 마지막 확인 commit을 확인한다.
3. `ai-ops pc done draft --cwd <현재 제품 repo 또는 경로>`를 실행한다. hook에서 이어진 경우 `ai-ops pc done draft --from-hook --cwd <project-git-root>`를 사용한다.
4. 생성된 draft 경로를 확인한다. draft는 `~/.personal-project-contexts/workspaces/<workspace-id>/.ai-ops/drafts/pc-done-<timestamp>.json` 아래에 생긴다.
5. 제품 repo의 commit log, diff summary, 테스트 결과, 사용자 대화, 참조 문서 phase/scope/제외 범위를 확인한다.
6. `ai-ops pc done fill --draft <draft-path> ... --apply`로 draft의 AI 작성 필드를 채우고 바로 반영한다.
   - `completed`: 완료한 일
   - `verification`: 테스트/빌드/확인
   - `remaining`: 아직 남은 일
   - `nextAction`: 다음 세션에서 바로 할 첫 행동
   - `nextActionEvidence`: 왜 이 행동이 stale하지 않은지에 대한 근거
   - `blockers`: 막힌 점 또는 확인 필요 사항
   - `durableContextDelta`: 장기 맥락이 실제로 바뀐 경우에만 작성. 없으면 `null` 유지
7. 다음 첫 행동을 정하기 전에 `Next Action Quality Rules`를 적용한다. 오래된 `남은 일`을 그대로 쓰지 말고, 이미 완료된 일/제외된 일/현재 repo에 없는 테스트 체계를 걸러낸다.
8. 직접 context markdown 파일이나 draft JSON 파일을 편집하지 않는다. 큰 `replaceOnce` script나 임시 JS를 만들지 않는다.
9. `fill --apply`는 draft schema, draft path, 현재 pc status, workspace/workstream/current entry, product `HEAD`를 검증하고, 허용된 context 파일만 갱신한다.
10. apply는 context repo에서만 stage/commit한다. product repo는 건드리지 않는다.
11. apply가 실패하면 메시지의 mismatch 이유를 보고 draft를 재생성하거나 현재 context 상태를 먼저 정리한다.

응답에는 context commit 요약, 오늘 완료한 일, entry별 확인 요약, 남은 일, 다음 첫 행동과 그 근거를 포함한다.

## Commit Rules

- context repo commit message는 짧은 한국어 또는 영어 명령형으로 쓴다.
- 권장 형식:
  - `Initialize workspace: <workspace-id>`
  - `Add workstream: <short-title>`
  - `Activate workstream: <short-title>`
  - `Record handoff: YYYY-MM-DD`
- commit할 변경이 없으면 commit하지 말고 "변경 없음"으로 보고한다.
