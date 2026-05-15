# Core Rule Authoring Guide

이 문서는 `apps/cli/data/rules/*.yaml`에 남아 있는 core rule 작성 기준을 설명한다. 새 agent operating layer 모델에서는 이 내용이 독립 제품 계층이 아니라 `AGENTS.md` canonical entrypoint에 포함될 always-loaded agent entry guidance의 원천으로 취급된다.

Phase 0에서는 code/data 파일을 수정하지 않는다. 따라서 현재 YAML 구조는 유지하되, 새 모델의 장기 방향은 project operating layer 문서로 렌더링되는 짧은 공통 지침이다.

## Scope

Rule YAML에는 항상 로드해도 되는 general rule만 둔다.

현재 core rule set:

| priority | id                |
| -------- | ----------------- |
| 90       | role-persona      |
| 85       | communication     |
| 80       | code-philosophy   |
| 75       | naming-convention |
| 71       | plan-mode         |

stack/framework/library/domain-specific guidance는 여기에 추가하지 않는다. 그런 지식은 global reference skill, global task skill, subagent, 또는 project operating layer의 `docs/agent/*`와 `docs/business/*`에 속한다.

## Schema

```yaml
id: kebab-case-only
category: persona
tags:
  - general
priority: 90
supported_tools:
  - claude-code
  - codex
  - gemini
content:
  constraints:
    - 'DO NOT ...'
  guidelines:
    - '...'
  decision_table:
    - when: '...'
      then: '...'
      avoid: '...'
```

Reference: `apps/cli/src/core/schemas/rule.schema.ts`

## 작성 기준

1. stack-agnostic이어야 한다.
2. 항상 로드해도 안전해야 한다.
3. permanent context cost를 정당화할 만큼 짧아야 한다.
4. 파일명은 `id`와 일치해야 한다.
5. `priority`는 중복되지 않아야 한다.

## Constraints vs Guidelines

| 항목             | 의미                                                   |
| ---------------- | ------------------------------------------------------ |
| `constraints`    | 품질 또는 안전 회귀를 막는 hard rule                  |
| `guidelines`     | 선호하는 작업 방식과 기본값                            |
| `decision_table` | 조건에 따라 적용되는 rule                              |

## Skill 또는 Operating Layer 문서로 분리할 때

다음 내용은 core rule로 추가하지 않는다.

- TypeScript 또는 Python 언어 가이드
- Next.js, NestJS, FastAPI, Flutter 같은 framework/runtime 가이드
- GraphQL client/server convention
- database 또는 migration 가이드
- 큰 backend standard pack
- 반복 실행 workflow
- 프로젝트별 business rule 또는 codebase map

재사용 가능한 실행 능력은 global skill/subagent로 둔다. 프로젝트별 사실과 운영 절차는 project operating layer 문서에 둔다.

## 검증

코드 변경 phase에서 rule schema나 렌더러를 수정했다면 다음을 실행한다.

```bash
npm run test --workspace=apps/cli
npm run build --workspace=apps/cli
```
