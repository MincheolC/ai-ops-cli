# Phase 3 구현 계획: Global Subagent 모델 추가

## 요약

`docs/plan.md`와 `docs/implementation-playbook.md` 기준으로 Phase 3은 **global subagent lifecycle**만 추가한다. 프로젝트 repo에는 아무 파일도 만들지 않고, `AI_OPS_HOME` 또는 `$HOME` 아래 도구별 global agent 위치에만 설치한다.

초기 catalog에는 `spec-to-packet`의 검증된 두 subagent를 이관한다.

```text
security-gate
security-reviewer
```

설치 경로:

```text
.codex/agents/<id>.toml
.claude/agents/<id>.md
.gemini/agents/<id>.md
.ai-ops/subagents-manifest.json
```

## 구현 변경

- `subagent` 명령을 추가한다.
  - `ai-ops subagent list`
  - `ai-ops subagent install <id> --tool <tool...>`
  - `ai-ops subagent diff [id]`
  - `ai-ops subagent update [id]`
  - `ai-ops subagent uninstall <id>`
  - `--tool` 생략 시 해당 subagent가 지원하는 모든 tool에 설치한다.
  - scope 옵션은 만들지 않는다.

- subagent data source를 추가한다.
  - 새 루트: `apps/cli/data/subagents/`
  - `subagent-registry.json`은 `id`, `supported_tools`, `source_path`를 관리한다.
  - 각 source directory는 `PROMPT.md`, `claude.frontmatter.yaml`, `codex.frontmatter.toml`, `gemini.frontmatter.yaml`를 가진다.
  - v1에서는 include-list 파일을 쓰지 않고 registry가 노출 여부의 source of truth다.

- renderer를 추가한다.
  - Claude/Gemini: YAML frontmatter + `PROMPT.md`를 합쳐 Markdown 생성.
  - Codex: TOML metadata + `developer_instructions` + `[[skills.config]]` 생성.
  - Codex `skill_names`는 source TOML에서 읽어 `AI_OPS_HOME/.agents/skills/<skill>/SKILL.md` 절대 경로로 렌더링한다.
  - 필요한 skill이 설치되어 있지 않아도 subagent 설치는 실패하지 않고 경고만 출력한다.

- registry와 lifecycle을 skills와 분리한다.
  - 새 상태 파일: `.ai-ops/subagents-manifest.json`
  - 상태 필드: `subagents`, `cliVersion`, `generatedAt`
  - installed record: `id`, `tools`, `installed_paths`, `sourceHash`
  - skills registry와 subagents registry는 서로 읽거나 쓰지 않는다.

- 설치/삭제 동작을 skill과 유사하게 만든다.
  - install은 기존 같은 id의 tool path를 교체한다.
  - 같은 id를 다른 tool로 다시 install하면 tools를 병합한다.
  - uninstall은 해당 id의 모든 installed path를 제거한다.
  - update는 manifest에 기록된 tools 기준으로 재렌더링한다.

- 문서를 갱신한다.
  - README 계열에 `subagent` 명령과 global-only 설치 정책을 추가한다.
  - `apps/cli/data/subagents/README.md`에 authoring contract를 추가한다.
  - `docs/implementation-playbook.md`의 Phase 3 검증 예시는 실제 초기 id인 `security-gate`로 바꾼다.

## 테스트 계획

- schema/loader
  - subagent registry schema가 kebab-case id, supported tools, source path를 검증한다.
  - source directory에 필수 파일이 없으면 명확히 실패한다.
  - 도구별 frontmatter의 name이 registry id와 다르면 실패한다.

- renderer
  - Claude output은 `.claude/agents/security-gate.md` 형태의 YAML frontmatter Markdown이다.
  - Gemini output은 `.gemini/agents/security-gate.md` 형태의 YAML frontmatter Markdown이다.
  - Codex output은 `.codex/agents/security-gate.toml`이고 `developer_instructions`와 `[[skills.config]]`를 포함한다.
  - sourceHash는 PROMPT와 도구별 metadata 변경에 반응한다.

- command e2e
  - `AI_OPS_HOME="$(mktemp -d)" ai-ops subagent install security-gate --tool codex`
  - 생성 파일은 `AI_OPS_HOME/.codex/agents/security-gate.toml`뿐이어야 한다.
  - 현재 cwd에는 `.codex`, `.claude`, `.gemini`, `.ai-ops`가 생기지 않아야 한다.
  - `subagent diff`, `subagent update`, `subagent uninstall`이 global manifest만 사용해야 한다.

- 전체 검증
  - `npm run check`
  - `npm run build`
  - `npm run compile`
  - `ai-ops subagent install security-reviewer --tool codex --tool claude-code --tool gemini` smoke test

## 가정과 기본값

- Phase 3은 subagents만 다룬다. `docs/specs` pack과 spec lifecycle skill 이관은 Phase 4 범위다.
- subagent 설치는 필요한 skills를 자동 설치하지 않는다.
- Codex subagent의 `skills.config.path`는 user base path 기준 절대 경로로 렌더링한다.
- 단일 tool 제거 옵션은 v1에서 제공하지 않는다. `uninstall <id>`는 해당 subagent 전체 제거다.
- 기존 `spec-to-packet` sync script와의 호환 마이그레이션은 만들지 않는다.
