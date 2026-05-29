---
name: doc-impact-reviewer
description: 변경 완료 또는 커밋 직전 diff를 보고 갱신해야 할 운영 문서 후보를 판정하고, 사용자 승인 후 승인된 문서만 수정한다.
disable-model-invocation: true
---

# doc-impact-reviewer

이 skill은 사용자가 명시적으로 호출했을 때만 사용한다. 자동 git hook, 자동 staging, 자동 commit을 만들거나 실행하지 않는다.

## 목적

구현 변경이 프로젝트 운영 문서에 미치는 영향을 짧고 근거 있게 판정한다.

결과는 다음 세 단계로 나눈다.

- `required`: 변경을 반영하지 않으면 운영 문서가 실제 동작과 어긋난다.
- `recommended`: 지금 반영하면 재진입, 리뷰, 운영 판단 비용이 줄어든다.
- `not needed`: 문서 영향이 없거나 기존 문서가 이미 충분하다.

## 입력 확인

먼저 diff 확인을 한다.

1. `git status --short`
2. `git diff --stat`
3. `git diff`
4. `git diff --name-only`
5. `git diff --cached --stat`
6. `git diff --cached`
7. `git diff --cached --name-only`
8. `git ls-files --others --exclude-standard`

staged 변경과 untracked 파일도 구현 영향에 포함한다.

프로젝트 운영 레이어가 있으면 존재하는 파일만 읽는다.

- `AGENTS.md`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`
- `docs/agent/rules/doc-update-rules.md`
- `docs/agent/checks/impact-checklist.md`

필요하면 변경 파일과 가까운 README, runbook, spec, API 문서도 읽되, 전체 문서를 기계적으로 훑지 않는다.

## 분류 기준

변경 파일과 diff를 다음 관점으로 분류한다.

- CLI/API surface: command, option, endpoint, request/response, public SDK contract
- manifest/schema: `.ai-ops/*`, registry, JSON schema, migration, generated index
- pack/specs: `docs/specs/`, optional pack, baseline/spec lifecycle
- skill/subagent catalog: skill source, subagent prompt, tool metadata, registry
- business/domain rule: 권한, 정책, 상태 전이, 요금, onboarding, domain validation
- verification/runtime docs: 배포, smoke, dry-run, OAuth/local setup, troubleshooting
- user-facing workflow: 설치, 사용 예시, operator flow, manual QA

## 보고 형식

문서 편집 전에는 문서 후보 제안을 먼저 보고하고 사용자 컨펌 전 편집 금지를 지킨다.

보고에는 다음을 포함한다.

- `required / recommended / not needed`별 갱신 후보 문서
- 각 후보의 근거가 되는 변경 파일 또는 diff 요약
- 갱신하지 않을 때의 리스크
- 읽었지만 영향 없음으로 판단한 문서
- 추가 확인이 필요한 질문이 있으면 최대 3개

보고는 짧게 작성한다. 문서 본문을 길게 재작성하지 말고, 승인 전에는 편집하지 않는다.

## 편집 규칙

사용자가 승인한 문서만 수정한다.

- 승인 범위 밖의 문서는 수정하지 않는다.
- 직접 commit하지 않는다.
- 직접 staging하지 않는다.
- 자동 hook, 자동 commit, 자동 staging 설정을 추가하지 않는다.
- 이미 있는 사용자 변경을 되돌리지 않는다.
- 변경 이유가 문서에 남아야 하는 경우에는 짧은 근거 문장만 추가한다.

## 보호 규칙

- Reserved 승격 금지: `Reserved` 문서는 명시 승인 없이 현재 사실 문서처럼 승격하거나 근거로 인용하지 않는다.
- create-only 문서 보호: 프로젝트 운영자가 채워야 하는 create-only 문서는 자동 덮어쓰지 않는다.
- adapter 보호: `GEMINI.md`, `CLAUDE.md`에는 canonical 운영 규칙을 복제하지 않는다. 필요한 경우 `AGENTS.md` 또는 해당 canonical 문서 갱신을 제안한다.
- stale 문서 보호: 구현 diff보다 오래된 문서는 사실로 단정하지 말고 후보 근거로만 다룬다.

## 완료 응답

승인 후 문서를 수정했다면 마지막에 다음을 요약한다.

- 수정한 문서
- 수정하지 않은 후보와 이유
- 남은 리스크 또는 후속 확인
- 실행한 검증 또는 생략한 검증

직접 커밋 금지와 직접 staging 금지를 마지막까지 유지한다.
