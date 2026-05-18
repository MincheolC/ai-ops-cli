---
name: context-promotion-review
description: 커밋 직전 현재 작업에서 core, project-local, global로 승격할 운영 지식 후보를 검토하고 사용자 결정 후 receipt를 기록한다.
---

# context-promotion-review

이 skill은 사용자가 명시적으로 호출했거나 `ai-ops` Codex hook이 커밋을 막았을 때만 사용한다. CLI가 AI 판단을 하지 않으므로, 승격 후보 판정은 현재 Codex 대화 맥락과 diff를 바탕으로 이 skill에서 수행한다.

## 목적

이번 작업 과정에서 반복 가능한 운영 지식, 명령 루틴, 판단 기준이 생겼는지 확인하고, 사용자에게 승격 여부를 묻는다.

분류는 다음 네 가지로만 한다.

- `core`: 모든 ai-ops 설치 프로젝트에 적용되어야 하는 제품 계약, CLI/Studio/schema/hook 동작
- `project-local`: 현재 프로젝트에서만 반복 적용되는 agent rule, workflow, QA, business/spec 운영 기준
- `global`: 여러 프로젝트에서 재사용할 skill, subagent, Codex hook 같은 runtime asset
- `no-promotion`: 일회성 구현 세부사항, 임시 디버깅, 승격 가치가 없는 내용

## 절차

1. `ai-ops context-promotion status`를 실행해 현재 fingerprint와 receipt 상태를 확인한다.
2. 실제 변경을 확인한다.
   - `git status --short`
   - `git diff --cached`
   - `git diff`
   - `git ls-files --others --exclude-standard`
3. 기존 context layer를 cross-check한다.
   - `AGENTS.md`
   - `docs/docs-status.md`
   - `.ai-ops/context-layer.json`
   - `docs/agent/rules/*`
   - `docs/agent/checks/*`
4. 이미 있는 규칙이면 `already-covered`로 보고하고 새 승격 후보로 만들지 않는다.
5. 새 후보가 있으면 `core`, `project-local`, `global` 중 하나 이상으로 분류하고, 추천 위치를 제안한다.
6. 후보가 없으면 `no-promotion` 결정을 제안한다.
7. 사용자 승인 전에는 파일을 수정하지 않는다.
8. 승인된 범위만 수정한다.
9. 마지막에 반드시 `ai-ops context-promotion resolve ...`를 실행한다.
10. 다시 `ai-ops context-promotion status`를 실행해 receipt 확인을 한다.

## 보고 형식

사용자에게 먼저 다음 형식으로 짧게 보고한다.

- `new candidates`: 새로 승격할 후보와 추천 scope/위치
- `already-covered`: 기존 context layer에 이미 있는 규칙과 근거 파일
- `no-promotion`: 승격하지 않을 항목과 이유
- `ask`: 사용자가 선택해야 할 결정

보고에는 각 후보의 근거를 함께 둔다. 근거는 현재 대화에서 반복된 판단, 사용자가 교정한 문장, 실행한 명령 루틴, 최종 diff 중 하나 이상이어야 한다.

## Resolve 규칙

사용자 결정이 끝나면 receipt를 기록한다.

승격이 있었으면:

```bash
ai-ops context-promotion resolve --decision promoted --scope core --summary "짧은 결정 요약"
```

필요하면 `--scope`와 `--target`을 여러 번 또는 배열 옵션으로 포함한다.

승격하지 않기로 했으면:

```bash
ai-ops context-promotion resolve --decision no-promotion --summary "이번 diff에는 승격할 반복 운영 지식 없음"
```

문서나 규칙을 수정한 경우에는 수정이 끝난 뒤 마지막 fingerprint 기준으로 resolve한다. resolve 이후에 diff가 바뀌면 receipt가 다시 missing이 될 수 있으므로, 최종 커밋 직전에 status를 다시 확인한다.

## 보호 규칙

- 사용자 승인 전 편집 금지: 후보 보고와 사용자 결정을 먼저 받는다.
- receipt 확인 필수: 완료 전에 `ai-ops context-promotion status`에서 receipt가 `found`인지 확인한다.
- 기존 규칙 중복 금지: 이미 있는 규칙은 새 문서나 중복 문장으로 승격하지 않는다.
- `Reserved` 승격 금지: 명시 승인 없이 `Reserved` 문서를 현재 판단 근거로 바꾸지 않는다.
- 직접 commit 금지: receipt 기록 후에도 commit은 사용자의 원래 요청 범위에 맞춰 별도로 진행한다.
