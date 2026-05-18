# pc Templates

이 파일은 `~/.personal-project-contexts/` 아래에 생성하는 workspace context 양식이다. 산출물의 제목과 필드 라벨은 한국어로 쓴다. 고유명사, 전문 용어, repo 이름, 경로, branch, command, package/library/service name, enum 값은 원문을 유지한다.

## `workspaces/<workspace-id>/workspace-state.md`

```markdown
# <워크스페이스 이름>

## 식별

- 워크스페이스 ID: <workspace-id>
- 워크스페이스 루트: <absolute-path>
- 생성일: YYYY-MM-DD
- 마지막 갱신일: YYYY-MM-DD

## 개요

<제품/도메인/작업 묶음의 핵심 맥락>

## 초기화 근거

- <읽은 workspace map/docs/manifests와 핵심 단서>

## 엔트리

- `<entry-id>`: <entry-type>, <absolute-path>

## 활성 Workstream

- ID: <workstream-slug-or-empty>
- 제목: <title-or-empty>
- 시작일: YYYY-MM-DD

## 현재 방향

<지금 중요하게 보고 있는 방향, 품질 기준, 운영상 주의점>

## 공통 명령

- 설치: <command-or-empty>
- 개발: <command-or-empty>
- 테스트: <command-or-empty>
- 빌드: <command-or-empty>

## 엔트리 간 주의사항

- <repo/service 간 함께 볼 주의사항>

## 마지막 Handoff

- 날짜: YYYY-MM-DD
- 요약: <지난 종료 시점 요약>
- 다음 첫 행동: <다음에 바로 할 일>

## 장기 결정

- YYYY-MM-DD: <오래 유지해야 할 결정>

## 메모

- <기타 장기 맥락>
```

## `workspaces/<workspace-id>/repos/<entry-id>.md`

```markdown
# <엔트리 이름>

## 식별

- 엔트리 ID: <entry-id>
- 엔트리 타입: <git-repo|monorepo-package|folder-service>
- 경로: <absolute-path>
- 워크스페이스 ID: <workspace-id>
- 생성일: YYYY-MM-DD
- 마지막 갱신일: YYYY-MM-DD

## 버전 관리

- 버전 관리: <git|none>
- Git 루트: <absolute-path-or-none>
- Remote URL: <remote-url-or-none>
- 기본 브랜치: <branch-or-none>

## 기술 스택

- 런타임: <runtime/framework>
- 패키지 매니저: <npm/pnpm/yarn/flutter/uv/etc-or-none>
- 주요 서비스: <short-summary>

## 초기화 근거

- <이 entry를 식별하고 채우는 데 사용한 파일/단서>

## 명령

- 설치: <command-or-empty>
- 개발: <command-or-empty>
- 테스트: <command-or-empty>
- 빌드: <command-or-empty>

## 주의사항

- <entry별 주의사항>

## Handoff 메모

- YYYY-MM-DD: <repo/service별 기억할 점>
```

## `workspaces/<workspace-id>/backlog.md`

```markdown
# Workstream Index

## 진행중

- [ ] `<workstream-slug>` <title>
  - 상태: Active
  - 범위: <entry-id-list-or-none>
  - 파일: workstreams/<workstream-slug>.md
  - 다음 첫 행동: <next-first-action>

## 미완료

- [ ] `<workstream-slug>` <title>
  - 상태: Planned|Paused
  - 생성일: YYYY-MM-DD
  - 범위: <entry-id-list-or-none>
  - 파일: workstreams/<workstream-slug>.md
  - 요약: <short-summary>

## 완료

- [x] `<workstream-slug>` <title>
  - 상태: Done
  - 완료일: YYYY-MM-DD
  - 파일: workstreams/<workstream-slug>.md
  - 요약: <result-summary>
```

Allowed status values: `Planned`, `Active`, `Paused`, `Done`.

## `workspaces/<workspace-id>/workstreams/<slug>.md`

```markdown
# <Workstream 제목>

## 식별

- ID: <slug>
- 상태: <Planned|Active|Paused|Done>
- 생성일: YYYY-MM-DD
- 마지막 갱신일: YYYY-MM-DD

## 범위

- 워크스페이스: <workspace-id>
- 엔트리:
  - <entry-id>

## 목표

<이 workstream의 완료 기준과 의도>

## 참조 문서

- 이름: <문서명 또는 사용자 제공 계획서>
  - 경로: <absolute-path-or-none>
  - 역할: <source-of-truth|planning-input|reference>

## 현재 상태

<현재 어디까지 왔는지>

## 오늘

- YYYY-MM-DD: <오늘 집중할 일>

## 다음 첫 행동

<다음 세션에서 바로 할 수 있는 첫 행동>

- 근거: <사용자 입력/commit evidence/참조 문서/파일 상태/기존 메모>
- 확인 필요: <없음 또는 다음 행동을 확정하기 전에 볼 것>

## 열린 질문

- <확인 필요 사항>

## 제외 범위

- <이번 workstream에서 하지 않을 일>

## 남은 일

- [ ] <남은 작업>

## 성공 기준

- <완료 판단 기준>

## 엔트리 상태

- `<entry-id>`: <변경/확인 요약>

## 마지막 확인 Commit

- `<entry-id>`: <commit-hash-or-none>

## Handoff

### YYYY-MM-DD

- 완료: <오늘 완료한 일>
- 엔트리별 근거:
  - `<entry-id>`: <commit range, git status/diff 또는 folder 변경 요약>
- 기록 기준:
  - 사용자 제공: <yes|no>
  - Commit range: <from..to-or-today-or-none>
- 남은 일: <남은 일>
- 다음 첫 행동: <다음 첫 행동>
- 다음 행동 근거: <왜 이것이 stale하지 않은 다음 행동인지>
- 막힌 점: <막힌 점 또는 없음>
```

## `daily/YYYY-MM-DD.md`

```markdown
# YYYY-MM-DD

## <workspace-id>

- 활성 Workstream: <workstream-slug-or-none>
- 엔트리: <entry-id-list-or-none>

### 시작 시점

<세션 시작 시점의 목표와 첫 행동>

### 완료

- <오늘 완료한 일>

### 근거

- `<entry-id>`: <git status/diff 또는 folder 변경 요약>
- 테스트 / 확인: <확인한 내용 또는 없음>

### 남은 일

- <남은 일>

### 다음 첫 행동

<다음 세션에서 바로 할 일>

- 근거: <사용자 입력/commit evidence/참조 문서/파일 상태/기존 메모>

### 메모

- <장기 맥락으로 승격할 필요는 없지만 남길 기록>
```
