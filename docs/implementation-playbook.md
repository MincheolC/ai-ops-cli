# 구현 플레이북

이 문서는 [docs/plan.md](./plan.md)의 agent operating layer 계약을 실제 phase 실행 순서와 검증 기준으로 옮긴다.

Phase 0은 문서 계약 고정 단계였다. 현재 repo 구현은 Phase 1-6 operating layer 모델을 기준으로 동작한다.

## 공통 실행 원칙

- 각 phase는 실제 기존 프로젝트 대신 임시 디렉터리에서 설치 결과를 검증한다.
- 실제 프로젝트의 old uninstall 후 new init은 모든 phase가 끝난 통합 검증에서만 수행한다.
- breaking release 정책을 유지한다. old `.ai-ops-manifest.json` 자동 마이그레이션은 만들지 않는다.
- project scope는 operating layer 문서만 다룬다.
- global scope는 skills/subagents만 다룬다.
- 코드 변경 phase에서는 먼저 실패 테스트나 fixture를 추가하고 구현한다.

## Phase 0: 계약 고정

범위:

- `docs/plan.md`를 새 master blueprint로 고정한다.
- README 계열 문서에 breaking model과 deprecated old model을 명시한다.
- historical 문서는 현재 계약으로 오해되지 않도록 상태를 표시한다.

완료 기준:

- 문서가 `ai-ops`를 project agent operating layer CLI로 정의한다.
- `AGENTS.md` canonical entrypoint와 `GEMINI.md`/`CLAUDE.md` adapter 계약이 명시된다.
- `docs/specs/`는 optional pack 위치로 고정된다.
- `--project`, project scope skill, `.ai-ops-manifest.json`, root `specs/`, preset-first, `apps/cli/data/rules/*.yaml`, `apps/cli/data/presets.yaml`는 deprecated/old model 문맥 안에만 남는다.
- 코드 파일은 수정하지 않는다.

검증:

```bash
rg -n -- '--project|project scope skill|\.ai-ops-manifest\.json|root `specs/`|preset-first|apps/cli/data/rules|apps/cli/data/presets.yaml' README.md apps/cli/README.md apps/cli/README.ko.md docs
```

검색 결과가 남아도 된다. 단, 모두 deprecated, old model, historical 문맥이어야 한다.

## Phase 1: Project Operating Layer MVP

범위:

- `ai-ops init/update/diff/uninstall`을 project operating layer 기준으로 재작성한다.
- root project 설치만 지원한다.
- `.ai-ops/manifest.json`과 `.ai-ops/context-layer.json`을 도입한다.
- `audit` 명령을 추가한다.
- old `.ai-ops-manifest.json` 기반 호환 마이그레이션은 구현하지 않는다.

생성 파일:

- `AGENTS.md`
- `GEMINI.md`
- `CLAUDE.md`
- `docs/agent/rules/00-agent-baseline.md`
- `docs/agent/workflow.md`
- `docs/agent/rules/routing-rules.md`
- `docs/agent/rules/doc-update-rules.md`
- `docs/agent/rules/stop-rules.md`
- `docs/agent/checks/impact-checklist.md`
- `docs/agent/checks/review-checklist.md`
- `docs/agent/maps/codebase-map.md`
- `docs/business/business-rules.md`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`

완료 기준:

- `AGENTS.md`가 canonical entrypoint다.
- `GEMINI.md`와 `CLAUDE.md`는 adapter로만 동작한다.
- `Reserved` 문서는 판단 근거로 사용하지 말라는 문구를 포함한다.
- `diff`는 manifest/context-layer/파일 drift를 감지한다.
- `audit`은 frontmatter, docs-status, manifest, context-layer 불일치를 읽기 전용으로 보고한다.
- `uninstall`은 project operating layer만 제거하고 global assets는 건드리지 않는다.

검증:

```bash
npm run check
tmpdir="$(mktemp -d)"
node apps/cli/dist/bin/index.js init --cwd "$tmpdir" --tool codex
find "$tmpdir" -maxdepth 4 -type f | sort
node apps/cli/dist/bin/index.js diff --cwd "$tmpdir"
node apps/cli/dist/bin/index.js audit --cwd "$tmpdir"
node apps/cli/dist/bin/index.js uninstall --cwd "$tmpdir"
```

명령 옵션은 구현 시 실제 CLI 표면에 맞게 조정한다.

## Phase 2: Global Skill 모델 단순화

범위:

- skills는 global 설치만 지원한다.
- reference/task skill catalog는 유지한다.
- project-installed skill 경로와 manifest 추적을 제거한다.
- `skill list/install/diff/update/uninstall`은 user/global registry만 다룬다.
- `--tool`은 유지한다.
- Deprecated old model: `--project`, `--global`, `--scope` skill 옵션과 project scope skill 동작을 제거한다.

완료 기준:

- skill 설치가 프로젝트 repo에 skill directory를 만들지 않는다.
- global registry만 skill 상태를 추적한다.
- Codex/Gemini/Claude별 global discovery 위치가 명확히 검증된다.
- old project skill metadata가 새 manifest에 들어가지 않는다.
- 공개 CLI 표면에 skill scope 지정 옵션이 남지 않는다.

검증:

```bash
npm run check
AI_OPS_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js skill install skill-load-check --tool codex
```

임시 프로젝트 디렉터리에는 `.agents/skills`, `.claude/skills`가 생기지 않아야 한다.

## Phase 3: Global Subagent 모델 추가

범위:

- subagent catalog를 추가한다.
- `subagent list/install/diff/update/uninstall`을 추가한다.
- 도구별 출력 경로와 파일 포맷 차이는 subagent renderer에서 처리한다.
- skills registry와 subagents registry는 분리한다.

완료 기준:

- subagent 설치/업데이트/삭제가 global registry에만 반영된다.
- 지원하지 않는 도구나 포맷은 명시적으로 실패한다.
- skill 명령과 subagent 명령의 상태 파일이 섞이지 않는다.

검증:

```bash
npm run check
AI_OPS_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js subagent install security-gate --tool codex
AI_OPS_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js subagent install security-reviewer --tool codex --tool claude-code --tool gemini
```

## Phase 4: Optional `docs/specs/` Pack

범위:

- `spec-lifecycle` pack을 추가한다.
- 설치 위치는 `docs/specs/`로 고정한다.
- 기존 root `specs/` scaffolding은 제거하거나 deprecated old model로만 남긴다.
- `spec-to-packet`의 `spec-product-*`, `spec-baseline-sync`, `spec-shared-glossary-sync`는 이 pack의 global skill 후보로 이관한다.
- 실제 spec 절차 실행은 global skill 후보로 분리한다.

완료 기준:

- pack 설치가 project operating layer manifest에 기록된다.
- `docs/specs/` 문서는 기본 `Reserved` 상태로 생성된다.
- root `specs/` 호환 옵션은 제공하지 않는다.
- pack uninstall/update가 project layer lifecycle과 충돌하지 않는다.

검증:

```bash
npm run check
repo="$(pwd)"
tmpdir="$(mktemp -d)"
cd "$tmpdir"
node "$repo/apps/cli/dist/bin/index.js" init --tool codex
node "$repo/apps/cli/dist/bin/index.js" pack install spec-lifecycle
find "$tmpdir/docs/specs" -maxdepth 3 -type f | sort
node "$repo/apps/cli/dist/bin/index.js" audit
```

`pack install`은 project operating layer를 자동 설치하지 않으므로, 검증은 항상 `ai-ops init --tool codex` 후에 진행한다.

## Phase 5: Doc Impact Reviewer

범위:

- commit 직전 또는 변경 완료 시 쓸 global task skill `doc-impact-reviewer`를 추가한다.
- v1은 subagent나 git hook이 아니라 수동 호출 skill로 둔다.
- diff를 보고 갱신 후보 문서를 `required / recommended / not needed`로 제안한다.
- 사용자 확인 후 문서 업데이트를 수행한다.
- 자동 git hook은 기본 설치하지 않는다. opt-in hook은 후속 기능으로만 둔다.

완료 기준:

- `doc-impact-reviewer`가 `task-skills/doc-impact-reviewer`와 `skill-registry.json`에 등록된다.
- Codex metadata는 `policy.allow_implicit_invocation: false`를 포함한다.
- Claude Code metadata는 `disable-model-invocation: true`를 포함한다.
- skill 설치는 기존 global skill lifecycle을 사용하며 project repo에 `.agents`, `.ai-ops`, `.codex`, `.claude`, `.gemini`를 만들지 않는다.
- reviewer는 직접 commit하지 않는다.
- reviewer는 직접 staging하지 않는다.
- `Reserved` 문서를 사실 근거로 승격하지 않는다.
- 갱신 후보, 이유, 미갱신 리스크를 짧게 보고한다.
- hook 없이도 수동 실행이 가능하다.

검증:

```bash
npm run check
npm run build
AI_OPS_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js skill install doc-impact-reviewer --tool codex
rg -n "diff 확인|문서 후보 제안|사용자 컨펌 전 편집 금지|직접 커밋 금지|Reserved 승격 금지" apps/cli/data/skills/task-skills/doc-impact-reviewer/SKILL.md
npm run compile
```

설치 smoke에서는 `AI_OPS_HOME/.agents/skills/doc-impact-reviewer/SKILL.md`와 `agents/openai.yaml`만 생기는지 확인한다. 실행 cwd에는 `.agents`, `.ai-ops`, `.codex`, `.claude`, `.gemini`가 새로 생기면 안 된다.

### Phase 5 후속: Context Promotion Review Follow-Up

범위:

- `doc-impact-reviewer`와 별개로 `context-promotion-review` Codex 전용 task skill을 추가한다.
- `ai-ops context-promotion status/resolve/prune`은 현재 `HEAD` 커밋에 대한 user-local receipt만 관리하고 프로젝트 repo에는 receipt를 쓰지 않는다.
- `ai-ops codex-hook install context-promotion`은 Codex `PostToolUse` Bash hook을 opt-in으로 설치하고 `context-promotion-review` Codex skill도 user-local global 위치에 보장 설치한다.
- hook은 `git commit` 이후 Codex에게 `context-promotion-review` 검토를 이어서 요청한다. 작업 커밋은 막지 않고, 승격 수정은 사용자 검사 후 별도 커밋으로 다룬다.
- 기본 hook command는 npm global 설치를 전제로 `ai-ops context-promotion hook post-tool-use`를 저장한다. 비표준 PATH 환경은 `--command` override로 처리한다.

검증:

```bash
npm run check
npm run build
AI_OPS_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js skill install context-promotion-review --tool codex
AI_OPS_HOME="$(mktemp -d)" CODEX_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js codex-hook install context-promotion
npm run compile
```

## Phase 6: 통합 검증과 dogfood

범위:

- 모든 phase 구현 후 실제 프로젝트에서 old artifact 정리 후 new init을 수행한다.
- 첫 dogfood 대상은 이 repo다.
- 외부 대표 프로젝트는 이번 phase에서 직접 수정하지 않고 적용 체크리스트 기준으로 후속 실행한다.
- Codex/Gemini/Claude에서 adapter가 `AGENTS.md` canonical 흐름을 실제로 유도하는지 확인한다.

완료 기준:

- old model 산출물이 새 project operating layer와 섞이지 않는다.
- `diff/update/audit/uninstall`이 실제 repo에서 기대대로 동작한다.
- global skills/subagents가 project repo에 복사되지 않는다.
- optional `docs/specs/` pack이 필요한 프로젝트에만 설치된다.

Self-dogfood 절차:

```bash
npm run build
node apps/cli/dist/bin/index.js init --tool codex --tool gemini --tool claude-code
node apps/cli/dist/bin/index.js diff
node apps/cli/dist/bin/index.js audit
node apps/cli/dist/bin/index.js update --force
node apps/cli/dist/bin/index.js diff
node apps/cli/dist/bin/index.js uninstall --yes
node apps/cli/dist/bin/index.js init --tool codex --tool gemini --tool claude-code
node apps/cli/dist/bin/index.js audit
```

이 repo의 최종 project layer:

- root `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`
- `docs/agent/*`
- `docs/business/*`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`

이 repo에서는 legacy `.claude/CLAUDE.md`와 `.claude/rules/*`를 제거하고, Claude Code adapter는 root `CLAUDE.md`만 둔다. Claude Code는 project rules로 `./.claude/rules/*.md`도 로드하므로, old sourceHash 규칙 파일을 남기면 new operating layer와 old model 지침이 함께 주입된다. `.claude/plans/*`와 `.claude/settings.local.json` 같은 기존 운영/로컬 파일은 Claude runtime rule 경로가 아니므로 이번 phase의 project layer adapter에서는 제외한다.

Optional pack 검증:

```bash
node apps/cli/dist/bin/index.js pack list
```

이 repo는 `.codex/plans/*` 중심으로 phase plan을 관리하므로 `spec-lifecycle` pack을 설치하지 않는다. `pack list`에서 `spec-lifecycle - not installed` 상태를 확인한다.

Global asset smoke:

```bash
home="$(mktemp -d)"
AI_OPS_HOME="$home" node apps/cli/dist/bin/index.js skill install doc-impact-reviewer --tool codex
AI_OPS_HOME="$home" node apps/cli/dist/bin/index.js subagent install security-gate --tool codex --tool claude-code --tool gemini
AI_OPS_HOME="$home" node apps/cli/dist/bin/index.js subagent install security-reviewer --tool codex --tool claude-code --tool gemini
```

검증 후 repo에 다음 경로가 생기면 실패다.

- `.agents/skills`
- `.codex/agents`
- `.claude/agents`
- `.gemini/agents`
- `.ai-ops/skills-manifest.json`
- `.ai-ops/subagents-manifest.json`
- `.claude/rules`

`.codex/plans`는 이 repo의 기존 운영 파일이므로 global asset 침범 여부 판단 대상에서 제외한다.

외부 대표 프로젝트 적용 체크리스트:

- 적용 전 old `AGENTS.md`, `GEMINI.md`, `.claude/CLAUDE.md`, `.claude/rules/*`, `.ai-ops-manifest.json`, root `specs/` 존재 여부를 기록한다.
- old CLI가 설치되어 있으면 old `ai-ops uninstall`로 제거하고, 불가능하면 제거할 legacy artifact를 명시적으로 review한다.
- 새 CLI로 `init --tool codex` 또는 해당 프로젝트가 실제 사용하는 tool set을 지정해 설치한다.
- `diff`, `audit`, `update --force`, `diff`를 실행한다.
- 해당 프로젝트가 spec lifecycle을 실제로 쓰는 경우에만 `pack install spec-lifecycle`을 실행한다.
- temp `AI_OPS_HOME` 또는 실제 사용자 home 중 하나를 명시해 skill/subagent 설치 위치가 repo 밖인지 확인한다.
- 적용 후 root `AGENTS.md`가 canonical entrypoint이고 tool adapter가 중복 운영 규칙을 담지 않는지 확인한다.
- `git status --short`로 project-owned 문서 변경과 ai-ops managed 변경을 분리해 리뷰한다.

## 운영 규칙

- 계약이 바뀌면 먼저 [docs/plan.md](./plan.md)를 수정한다.
- phase 실행 절차나 검증 기준이 바뀌면 이 문서를 수정한다.
- temporary compatibility는 명시적으로 만료 조건을 적는다.
- 외부 프로젝트 재설치는 Phase 6 체크리스트 기준으로 별도 review 가능한 변경으로 수행한다.
