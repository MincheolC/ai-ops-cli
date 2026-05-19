---
name: context-promotion-review
description: 방금 완료된 작업 커밋에서 core, project-local, global로 승격할 운영 지식 후보를 검토하고 사용자 결정 후 receipt를 기록한다.
---

# context-promotion-review

이 skill은 사용자가 명시적으로 호출했거나 `ai-ops` Codex PostToolUse hook이 작업 커밋 직후 후속 검토를 요청했을 때만 사용한다. CLI가 AI 판단을 하지 않으므로, 승격 후보 판정은 현재 Codex 대화 맥락과 방금 만든 `HEAD` 커밋을 바탕으로 이 skill에서 수행한다.

hook이 전달한 Project root가 이 검토의 유일한 프로젝트 기준이다. 먼저 해당 Project root로 shell 기준을 맞추고, 다른 repo, parent directory, 이전 대화의 workspace, 웹 검색, 외부 문서를 사용하지 않는다. `AGENTS.md`, `docs/agent/*`, `docs/docs-status.md`, `.ai-ops/context-layer.json` 같은 context layer 파일이 없으면 없다고 보고하며 다른 repo 파일로 대체하지 않는다.

## 목적

방금 완료된 작업 커밋에서 반복 가능한 운영 지식, 명령 루틴, 판단 기준이 생겼는지 확인하고, 사용자에게 승격 여부를 묻는다.

검토 결과는 다음 다섯 가지로만 정리한다.

- `core`: 모든 ai-ops 설치 프로젝트에 적용되어야 하는 제품 계약, CLI/Studio/schema/hook 동작
- `project-local`: 현재 프로젝트에서만 반복 적용되는 agent rule, workflow, QA, business/spec 운영 기준
- `global`: 여러 프로젝트에서 재사용할 skill, subagent, Codex hook 같은 runtime asset
- `already-covered`: 이미 기존 context layer에 있는 기준이라 새 승격이 필요 없는 내용
- `no-promotion`: 일회성 구현 세부사항, 임시 디버깅, 승격 가치가 없는 내용

## 절차

1. hook 또는 사용자 요청에 표시된 Project root로 이동한다. Project root 밖 파일은 읽지 않는다.
2. `ai-ops context-promotion status`를 실행해 현재 `HEAD`, fingerprint, receipt 상태를 확인한다.
3. 방금 완료된 작업 커밋을 확인한다.
   - `git show --stat HEAD`
   - `git show --name-only HEAD`
   - 필요 시 `git show HEAD`
4. 기존 context layer를 cross-check한다.
   - `AGENTS.md`
   - `docs/docs-status.md`
   - `.ai-ops/context-layer.json`
   - `docs/agent/rules/*`
   - `docs/agent/checks/impact-checklist.md`
5. context layer 파일이 없으면 absent로 기록하고, 다른 repo에서 대체 근거를 찾지 않는다.
6. 이미 있는 규칙이면 `already-covered`로 보고하고 새 승격 후보로 만들지 않는다.
7. 새 후보가 있으면 `core`, `project-local`, `global` 중 하나 이상으로 분류하고, 추천 위치를 제안한다.
8. 후보가 없으면 `no-promotion` 결정을 제안한다.
9. 사용자 승인 전에는 파일을 수정하지 않는다.
10. 승인된 범위만 수정한다.
11. 마지막에 반드시 `ai-ops context-promotion resolve ...`를 실행한다.
12. 다시 `ai-ops context-promotion status`를 실행해 현재 `HEAD` receipt 확인을 한다.
13. 승격 파일을 수정했더라도 직접 commit하지 않고 사용자 검사 대기 상태로 멈춘다.

## 보고 형식

사용자에게 먼저 다음 형식으로 짧게 보고한다.

- `new candidates`: 새로 승격할 후보와 추천 scope/위치
- `already-covered`: 기존 context layer에 이미 있는 규칙과 근거 파일
- `no-promotion`: 승격하지 않을 항목과 이유
- `ask`: 사용자가 선택해야 할 결정

보고에는 각 후보의 근거를 함께 둔다. 근거는 현재 대화에서 반복된 판단, 사용자가 교정한 문장, 실행한 명령 루틴, 방금 완료된 `HEAD` 커밋 중 하나 이상이어야 한다.

## Resolve 규칙

사용자 결정이 끝나면 현재 `HEAD` 커밋에 대한 receipt를 기록한다.

승격이 있었으면:

```bash
ai-ops context-promotion resolve --decision promoted --scope core --summary "짧은 결정 요약"
```

필요하면 `--scope`와 `--target`을 여러 번 또는 배열 옵션으로 포함한다.

승격하지 않기로 했으면:

```bash
ai-ops context-promotion resolve --decision no-promotion --summary "이번 작업 커밋에는 승격할 반복 운영 지식 없음"
```

문서나 규칙을 수정한 경우에도 작업 커밋을 amend하거나 섞지 않는다. 승인된 승격 수정만 적용하고 receipt를 기록한 뒤, 사용자에게 검사를 요청한다. 승격 커밋은 사용자가 별도로 요청할 때만 진행한다.

## 보호 규칙

- 사용자 승인 전 편집 금지: 후보 보고와 사용자 결정을 먼저 받는다.
- Project root 고정: hook이 전달한 Project root 안에서만 읽고 판단한다.
- 웹 검색 금지: 이 검토는 외부 문서나 웹 검색을 사용하지 않는다.
- 다른 repo 탐색 금지: parent directory, sibling repo, 이전 대화 workspace를 cross-check 근거로 사용하지 않는다.
- receipt 확인 필수: 완료 전에 `ai-ops context-promotion status`에서 현재 `HEAD` receipt가 `found`인지 확인한다.
- 기존 규칙 중복 금지: 이미 있는 규칙은 새 문서나 중복 문장으로 승격하지 않는다.
- `Reserved` 승격 금지: 명시 승인 없이 `Reserved` 문서를 현재 판단 근거로 바꾸지 않는다.
- 직접 commit 금지: 승격 수정 후에도 commit하지 않고 사용자 검사 대기 상태로 멈춘다.
