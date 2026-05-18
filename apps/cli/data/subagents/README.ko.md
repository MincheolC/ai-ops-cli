# Subagent 작성 가이드

[English](./README.md)

이 디렉터리는 global agent subagent의 source of truth입니다.

## 디렉터리 구조

```text
apps/cli/data/subagents/
  README.md
  README.ko.md
  subagent-registry.json
  <subagent-id>/
    PROMPT.md
    claude.frontmatter.yaml
    codex.frontmatter.toml
    gemini.frontmatter.yaml
```

## 작성 규칙

1. `subagent-registry.json`만 catalog 노출 여부를 결정합니다.
2. `id`와 세 frontmatter의 `name`은 모두 같은 kebab-case 값이어야 합니다.
3. `supported_tools`는 `claude-code`, `codex`, `gemini` 중 하나 이상이어야 합니다.
4. `PROMPT.md`는 도구 공통 developer instruction 본문입니다.
5. Claude/Gemini는 YAML frontmatter와 `PROMPT.md`를 합친 Markdown 파일로 렌더링됩니다.
6. Codex는 TOML metadata, `developer_instructions`, `[[skills.config]]`로 렌더링됩니다.
7. Codex `skill_names`는 최종 파일에 그대로 남기지 않고 `AI_OPS_HOME/.agents/skills/<skill>/SKILL.md` 절대 경로로 변환합니다.
8. 필요한 skill이 없어도 설치는 실패하지 않습니다. CLI는 경고만 출력합니다.
9. subagent는 항상 global tool home에만 설치합니다. project repo에는 `.codex/agents`, `.claude/agents`, `.gemini/agents`, `.ai-ops/subagents-manifest.json`을 만들지 않습니다.

## Registry 필드

| 필드 | 필수 | 예시 | 의미 |
| --- | --- | --- | --- |
| `id` | 예 | `security-gate` | canonical subagent id |
| `supported_tools` | 예 | `["claude-code", "codex", "gemini"]` | 설치 가능한 도구 목록 |
| `source_path` | 예 | `security-gate` | 상대 source 디렉터리 |

## 출력 경로

| 도구 | 출력 경로 |
| --- | --- |
| Codex | `.codex/agents/<id>.toml` |
| Claude Code | `.claude/agents/<id>.md` |
| Gemini CLI | `.gemini/agents/<id>.md` |

상태 파일은 `.ai-ops/subagents-manifest.json`입니다. Skill 상태 파일인 `.ai-ops/skills-manifest.json`과 서로 읽거나 쓰지 않습니다.
