# Skill 작성 가이드

[English](./README.md)

이 디렉터리는 설치 가능한 agent skill의 source of truth입니다.

## 용어

### Reference Skill

`reference skill`은 lazy-load되는 지식 pack입니다.

- 정식 상세 내용은 `references/reference.md`에 둡니다.
- `SKILL.md`는 얇게 유지하고, agent가 언제 skill을 써야 하는지와 무엇을 먼저 읽어야 하는지만 안내합니다.
- 표준, stack 가이드, 큰 도메인 reference에 사용합니다.

### Task Skill

`task skill`은 절차형 workflow입니다.

- 정식 절차는 `SKILL.md`에 둡니다.
- `references/`는 선택적인 보조 자료입니다.
- 반복 가능한 점검, 작업, guided workflow에 사용합니다.

### Task Skill 사용

반복되는 운영 절차는 task skill로 둡니다. 예를 들어 `doc-impact-reviewer`는 변경 완료 또는 커밋 직전에 diff를 확인하고, 갱신 후보 문서를 `required / recommended / not needed`로 제안한 뒤 사용자 승인 후 승인된 문서만 수정합니다.

승인이 필요한 task skill은 자동 호출을 막습니다.

- Codex: `agents/openai.yaml`에 `policy.allow_implicit_invocation: false`를 둡니다.
- Claude Code: `SKILL.md` frontmatter에 `disable-model-invocation: true`를 둡니다.
- Gemini CLI: skill-level explicit-only flag가 없으므로 본문에 명시 호출 전용 규칙을 적습니다.

설치 예시:

```bash
ai-ops skill install doc-impact-reviewer --tool codex
ai-ops skill install context-promotion-review --tool codex
```

## 디렉터리 구조

```text
apps/cli/data/skills/
  README.md
  README.ko.md
  skill-registry.json
  reference-skills/
    <skill-name>/
      SKILL.md
      agents/       # optional
      references/   # required for reference skills
      assets/       # optional
      scripts/      # optional
  task-skills/
    <skill-name>/
      SKILL.md
      references/   # optional
      assets/       # optional
      scripts/      # optional
```

## 작성 규칙

1. 디렉터리 이름은 frontmatter `name`과 정확히 일치해야 합니다.
2. `SKILL.md`는 YAML frontmatter로 시작해야 합니다.
3. `kind`, `supported_tools`, preset grouping, `source_path`는 `skill-registry.json`에 둡니다.
4. `reference` skill은 `reference-skills/` 아래에 두고 `references/reference.md`를 포함해야 합니다.
5. `task` skill은 `task-skills/` 아래에 두고 실행 절차를 `SKILL.md`에 둡니다.
6. 같은 상세 내용을 `SKILL.md`와 `references/`에 중복하지 않습니다.
7. 도구별 metadata는 skill source 안에 직접 작성하고 CLI가 그대로 복사합니다.
8. Codex와 Gemini는 `.agents/skills/<skill-name>`에 설치합니다. Claude는 `.claude/skills/<skill-name>`에 설치합니다.
9. CLI는 skill 디렉터리 트리 전체를 그대로 복사하므로 `agents/`, `references/`, `assets/`, `scripts/` 아래 파일은 변경 없이 설치됩니다.

## Frontmatter 필드

`SKILL.md` frontmatter는 이제 agent-facing 용도입니다. CLI는 아래 필수 필드를 검증하고, 추가 도구별 frontmatter 필드는 무시합니다.

| 필드 | 필수 | 예시 | 의미 |
| --- | --- | --- | --- |
| `name` | 예 | `graphql-contract` | 고유 skill 이름과 설치 디렉터리 key |
| `description` | 예 | `Use when changing GraphQL schema contracts.` | discovery/autotrigger 요약 |

## Registry 필드

`skill-registry.json`은 install/catalog SSOT입니다.

| 필드 | 필수 | 예시 | 의미 |
| --- | --- | --- | --- |
| `id` | 예 | `graphql-contract` | canonical skill id |
| `kind` | 예 | `reference` / `task` | skill category |
| `supported_tools` | 예 | `["claude-code", "codex", "gemini"]` | 설치 가능한 도구 |
| `groups` | 예 | `["frontend-web"]` | 표시/discovery grouping |
| `included_in_presets` | 예 | `["frontend-web", "backend-ts"]` | `ai-ops init`에서 이 skill을 노출하는 preset |
| `source_path` | 예 | `reference-skills/graphql-contract` | skill source가 있는 상대 디렉터리 |

## Content 배치

### Reference Skill

- `SKILL.md`: 짧은 routing note
- `references/reference.md`: 전체 상세 내용

### Task Skill

- `SKILL.md`: 실행 가능한 전체 절차
- `references/`: 선택적인 배경 자료
- `scripts/`: 선택적인 실행 helper

## 도구별 호출 제어

skill을 explicit-only로 만들어야 하면 skill 작성자가 도구별 metadata를 직접 추가해야 합니다.

### Codex

`agents/openai.yaml`을 직접 만듭니다.

```yaml
allow_implicit_invocation: false
```

- Codex가 description만 보고 skill을 자동 호출하면 안 될 때 사용합니다.
- CLI가 전체 디렉터리 트리를 복사하므로 `agents/openai.yaml`은 그대로 설치됩니다.

### Claude Code

`SKILL.md` frontmatter에 `disable-model-invocation: true`를 직접 추가합니다.

```yaml
---
name: deploy-script
description: Runs the deployment workflow.
disable-model-invocation: true
---
```

- Claude가 명시적인 `/skill-name` 호출로만 skill을 로드해야 할 때 사용합니다.
- CLI는 이 추가 frontmatter 필드를 보존하고 자동 생성하지 않습니다.

### Gemini CLI

Gemini CLI는 현재 implicit invocation 비활성화를 위한 skill-level frontmatter flag를 제공하지 않습니다.

- Gemini에서 explicit-only 동작이 필요하면 custom command를 사용합니다.
- 가짜 Gemini 전용 필드를 `SKILL.md`에 추가하지 마세요. Gemini가 해석하지 않습니다.

## 예시

### Reference Skill Skeleton

```text
reference-skills/graphql-contract/
  SKILL.md
  agents/
    openai.yaml      # optional
  references/
    reference.md
```

### Task Skill Skeleton

```text
task-skills/skill-load-check/
  SKILL.md
  scripts/
    loaded.js
```

## 임시 검증 Skill

`skill-load-check`는 임시 검증 skill 예시입니다.

- description은 좁고 test-focused하게 유지합니다.
- 본문은 짧고 절차형으로 유지합니다.
- install/load workflow가 검증된 뒤에는 나중에 삭제해도 됩니다.

## 운영 Task Skill

`doc-impact-reviewer`는 운영 문서 영향도를 수동으로 검토하는 task skill입니다.

- git status, diff, 변경 파일, 관련 operating-layer 문서를 읽습니다.
- 편집 전에 문서 후보와 리스크를 보고합니다.
- 사용자 확인 전에는 편집하지 않습니다.
- staging, commit, hook 설치를 직접 수행하지 않습니다.

`context-promotion-review`는 작업 커밋 직후 반복 운영 지식 승격 후보를 검토하는 Codex 전용 task skill입니다.

- 기존 context layer를 먼저 cross-check합니다.
- 후보를 core, project-local, global, no-promotion으로 분류합니다.
- 최종 결정은 `ai-ops context-promotion resolve`로 기록합니다.
- 승인된 승격 수정은 사용자 검사를 위해 커밋하지 않은 상태로 남깁니다.
- 현재 `HEAD`에 대해 `ai-ops context-promotion status`로 receipt를 확인합니다.
