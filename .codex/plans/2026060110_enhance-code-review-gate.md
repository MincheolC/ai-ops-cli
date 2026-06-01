# code-review-gate Baseline & Reviewer Model Documentation

## Summary

- `README.md`는 Codex subagent 런타임에 자동 로드되지 않는 것으로 본다. 현재 renderer는 `PROMPT.md`를 Codex agent TOML의 `developer_instructions`로 넣고, `codex.frontmatter.toml`의 `skill_names`를 `skills.config`로 렌더링한다.
- 따라서 런타임 계약은 [PROMPT.md](/Users/charles/ai-projects/ai-ops-cli/apps/cli/data/subagents/code-review-gate/PROMPT.md:1)에 넣고, 새 `README.md`는 source/maintainer 문서로 추가한다.
- 컨셉은 “하나의 read-only reviewer가 여러 렌즈를 적용한다”로 고정하고, parallel reviewer fan-out으로 오해되지 않게 문서화한다.

## Key Changes

- [PROMPT.md](/Users/charles/ai-projects/ai-ops-cli/apps/cli/data/subagents/code-review-gate/PROMPT.md:1)에 `Operating layer baseline` 규칙을 추가한다.
  - `AGENTS.md`, `docs/agent/rules/00-agent-baseline.md`, `docs/agent/workflow.md`, 관련 `Active` 문서를 리뷰 판단 기준으로 적용한다.
  - 단, 이 문서들은 판단 기준이지 자동 finding surface가 아니며, scope-map의 included surface에 들어올 때만 직접 리뷰 대상이 된다.
- 같은 `PROMPT.md`에 context 관리 원칙을 짧게 추가한다.
  - 하나의 read-only reviewer가 `scope-map -> focused passes -> final-gate` 순서로 렌즈를 적용한다.
  - 별도 reviewer들을 무조건 병렬 spawn하지 않는다.
  - 큰 diff/project-wide 리뷰에서는 included/excluded surface와 residual risk를 명시한다.
- `apps/cli/data/subagents/code-review-gate/README.md`를 새로 만든다.
  - Mermaid diagram으로 “single read-only reviewer + multiple lenses” 흐름을 보여준다.
  - 리뷰 타겟 선정 규칙을 `plan_current_changes`, `plan_head_commit`, `project_wide`, `feature`, `module`, `diff_default`, `ambiguity stop` 순서로 요약한다.
  - 컨텍스트 관리 핵심: baseline은 판단 기준, scope-map-first, 필요한 lens만 적용, raw evidence를 과도하게 끌고 오지 않기, project-wide complete coverage 금지.
  - 렌즈별 표: scope-map, correctness, security, state/concurrency, test-quality, architecture/ops, final-gate.

## Public Contract / Runtime Impact

- CLI command surface, integration component count, skill names, subagent install paths는 바꾸지 않는다.
- `PROMPT.md` 변경은 Codex subagent의 `developer_instructions`와 installed integration `sourceHash`에 반영된다.
- `README.md` 변경은 source documentation이며, 현재 설계에서는 installed Codex agent context나 `sourceHash`에 직접 반영하지 않는다.

## Test Plan

- `apps/cli/src/core/__tests__/subagent-loader.test.ts`에 prompt 계약 assertion을 추가한다.
  - baseline 문서 적용 문구 포함.
  - single read-only reviewer / multiple lenses 컨셉 포함.
  - README가 런타임 계약이 아니라는 오해를 피하도록 prompt 쪽 계약이 존재하는지 확인.
- 실행할 검증:
  - `npm test -- apps/cli/src/core/__tests__/subagent-loader.test.ts`
  - `npm run build --workspace=apps/cli`
  - `git diff --check`

## Assumptions

- `README.md`는 maintainer-facing English 문서로 작성한다. 런타임 prompt/skill 문서가 이미 English인 패턴을 따른다.
- Codex가 subagent source directory의 README를 자동 로드하도록 renderer를 바꾸지는 않는다.
- 여러 독립 subagent 리뷰어를 추가하지 않고, 현재 1 subagent + 7 task skill 구조를 유지한다.
