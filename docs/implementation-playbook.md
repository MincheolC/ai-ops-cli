# 구현 플레이북

이 문서는 [docs/plan.md](./plan.md)의 agent operating layer 계약을 실제 phase 실행 순서와 검증 기준으로 옮긴다.

Phase 0은 문서 계약 고정 단계다. CLI 구현, schema, renderer, manifest, 테스트 코드는 수정하지 않는다.

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
- README 계열 문서에 planned breaking model과 deprecated old model을 명시한다.
- historical 문서는 현재 계약으로 오해되지 않도록 상태를 표시한다.

완료 기준:

- 문서가 `ai-ops`를 project agent operating layer CLI로 정의한다.
- `AGENTS.md` canonical entrypoint와 `GEMINI.md`/`CLAUDE.md` adapter 계약이 명시된다.
- `docs/specs/`는 optional pack 위치로 고정된다.
- `--project`, project scope skill, `.ai-ops-manifest.json`, root `specs/`, preset-first는 deprecated/old model 문맥 안에만 남는다.
- 코드 파일은 수정하지 않는다.

검증:

```bash
rg -n -- '--project|project scope skill|\.ai-ops-manifest\.json|root `specs/`|preset-first' README.md apps/cli/README.md apps/cli/README.ko.md docs
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
AI_OPS_HOME="$(mktemp -d)" node apps/cli/dist/bin/index.js subagent install <fixture-id> --tool codex
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
tmpdir="$(mktemp -d)"
node apps/cli/dist/bin/index.js pack install spec-lifecycle --cwd "$tmpdir"
find "$tmpdir/docs/specs" -maxdepth 3 -type f | sort
node apps/cli/dist/bin/index.js audit --cwd "$tmpdir"
```

명령 이름은 구현 phase에서 확정한다.

## Phase 5: Doc Impact Reviewer

범위:

- commit 직전 또는 변경 완료 시 쓸 global skill/subagent를 추가한다.
- diff를 보고 갱신 후보 문서를 제안한다.
- 사용자 확인 후 문서 업데이트를 수행한다.
- 자동 git hook은 기본 설치하지 않는다. opt-in hook은 후속 기능으로만 둔다.

완료 기준:

- reviewer는 직접 commit하지 않는다.
- `Reserved` 문서를 사실 근거로 승격하지 않는다.
- 갱신 후보, 이유, 미갱신 리스크를 짧게 보고한다.
- hook 없이도 수동 실행이 가능하다.

## Phase 6: 통합 검증과 dogfood

범위:

- 모든 phase 구현 후 실제 프로젝트에서 old uninstall 후 new init을 수행한다.
- 첫 dogfood 대상은 이 repo다.
- 이후 대표 프로젝트 1개에 적용한다.
- Codex/Gemini/Claude에서 adapter가 `AGENTS.md` canonical 흐름을 실제로 유도하는지 확인한다.

완료 기준:

- old model 산출물이 새 project operating layer와 섞이지 않는다.
- `diff/update/audit/uninstall`이 실제 repo에서 기대대로 동작한다.
- global skills/subagents가 project repo에 복사되지 않는다.
- optional `docs/specs/` pack이 필요한 프로젝트에만 설치된다.

## 운영 규칙

- 계약이 바뀌면 먼저 [docs/plan.md](./plan.md)를 수정한다.
- phase 실행 절차나 검증 기준이 바뀌면 이 문서를 수정한다.
- temporary compatibility는 명시적으로 만료 조건을 적는다.
- 실제 프로젝트 재설치는 통합 검증 phase 전까지 하지 않는다.
