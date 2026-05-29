# AI Agent Operating Layer 전환 전체 계획

## 요약

`ai-ops`를 “프로젝트 안에 AI agent operating layer를 설치하고 유지하는 CLI”로 재정의한다. 프로젝트에는 운영 문서만 설치하고, skills/subagents는 사용자 환경의 global asset으로 설치한다.

```text
Project repo
  AGENTS.md
  GEMINI.md / CLAUDE.md
  docs/agent/*
  docs/business/*
  docs/docs-status.md
  docs/specs/*        # optional pack
  .ai-ops/manifest.json
  .ai-ops/context-layer.json

Global tool home
  skills/*
  subagents/*
```

이번 전환은 breaking change로 처리한다. 기존 프로젝트 호환 마이그레이션은 만들지 않고, 기존 사용자는 old CLI로 `uninstall` 후 새 모델로 재설치한다.

## 핵심 변경

- `AGENTS.md`를 canonical agent entrypoint로 둔다.
  - `GEMINI.md`, `CLAUDE.md`는 얇은 adapter로 두고 `AGENTS.md`를 우선 기준으로 읽도록 지시한다.
  - 중복을 피하기 위해 `docs/agent/AGENTS.md`는 만들지 않는다.

- 프로젝트 설치 대상은 agent operating layer로 고정한다.
  - `docs/agent/workflow.md`
  - `docs/agent/rules/routing-rules.md`
  - `docs/agent/rules/doc-update-rules.md`
  - `docs/agent/rules/stop-rules.md`
  - `docs/agent/checks/impact-checklist.md`
  - `docs/agent/checks/review-checklist.md`
  - `docs/agent/maps/codebase-map.md`
  - `docs/business/business-rules.md`
  - `docs/docs-status.md`

- 문서 신뢰도는 frontmatter와 `docs/docs-status.md`로 관리한다.
  - 공통 메타: `status`, `layer`, `owner`, `read_when`, `update_when`
  - 기본 `Active`: workflow/rules/checks
  - 기본 `Reserved`: codebase-map, business-rules, optional specs의 프로젝트별 빈 문서
  - `Reserved` 문서는 판단 근거로 쓰지 말라고 명시한다.

- scope 모델을 단순화한다.
  - project scope: operating layer 문서만
  - global scope: skills/subagents만
  - `skill` 명령에서 `--project`, `--global`, `--scope` 공개 옵션을 제거한다.
  - `--tool` 선택은 유지한다. 설치 위치가 Codex/Claude/Gemini마다 다르기 때문이다.

- `specs`는 optional pack으로만 설치한다.
  - 설치 위치는 `docs/specs/`로 고정한다.
  - 기존 루트 `specs/` 호환 옵션은 만들지 않는다.
  - 현재 `spec init`은 새 pack 설치 모델로 대체한다.

## Phase 계획

1. **Phase 0: 계약 고정**
   - `docs/plan.md`, README, CLI 용어를 새 모델로 정리한다.
   - 핵심 문장: “`ai-ops`는 프로젝트에는 agent operating layer를 설치하고, 사용자 환경에는 agent skills/subagents를 설치한다.”
   - 기존 프로젝트는 uninstall 후 reinstall한다는 breaking policy를 명시한다.

2. **Phase 1: Project Operating Layer MVP**
   - `ai-ops init/update/diff/uninstall`을 새 project layer 기준으로 재작성한다.
   - `.ai-ops/manifest.json`과 `.ai-ops/context-layer.json`을 도입한다.
   - 기존 `.ai-ops-manifest.json` 기반 호환 마이그레이션은 구현하지 않는다.
   - `audit` 명령을 추가해 frontmatter/docs-status/manifest 불일치를 읽기 전용으로 검사한다.

3. **Phase 2: Global Skill 모델 단순화**
   - skills는 global 설치만 지원한다.
   - reference/task skill catalog는 유지하되 project-installed skill 경로와 manifest 추적을 제거한다.
   - `skill list/install/diff/update/uninstall`은 user/global registry만 다룬다.

4. **Phase 3: Global Subagent 모델 추가**
   - subagent catalog와 `subagent list/install/diff/update/uninstall`을 추가한다.
   - Codex/Claude/Gemini별 출력 경로와 파일 포맷 차이는 subagent renderer에서 처리한다.
   - skills와 subagents는 모두 global asset이지만 registry는 분리한다.

5. **Phase 4: Optional `docs/specs` Pack**
   - `spec-lifecycle` pack을 추가하고 설치 위치를 `docs/specs/`로 고정한다.
   - `spec-to-packet`의 `spec-product-*`, `spec-baseline-sync`, `project-terminology-sync`는 이 pack의 global skills 후보로 이관한다.
   - pack 설치는 프로젝트 문서 구조만 만들고, 실제 절차 실행은 global skill이 담당한다.

6. **Phase 5: Doc Impact Reviewer**
   - commit 직전 또는 변경 완료 시 사용할 global skill/subagent를 추가한다.
   - 역할: diff를 보고 갱신 후보 문서를 제안하고, 사용자 확인 후 문서 업데이트를 수행한다.
   - 자동 git hook은 기본 설치하지 않는다. 나중에 opt-in hook으로만 제공한다.

7. **Phase 6: 통합 검증과 dogfood**
   - 모든 phase 구현 후 실제 프로젝트에 old uninstall → new init을 수행한다.
   - 먼저 `ai-ops-scaffolder` 자체에서 dogfood하고, 그 다음 대표 프로젝트 1개에 적용한다.
   - Codex/Gemini/Claude에서 `AGENTS.md` canonical 흐름이 실제로 읽히는지 확인한다.

## 테스트 계획

- 각 phase마다 실제 프로젝트 대신 임시 디렉터리에서 설치 결과를 검증한다.
  - `npm run check`
  - 임시 repo에서 `ai-ops init`
  - 생성 파일 구조 확인
  - `diff/update/audit/uninstall` 확인
  - manifest와 context-layer index hash 확인

- Phase 2 이후에는 global skill registry만 검증한다.
  - project repo에 skill 디렉터리가 생성되지 않아야 한다.
  - Codex/Gemini는 `.agents/skills`, Claude는 `.claude/skills`에 설치되는지 확인한다.

- Phase 3 이후에는 subagent 설치 경로와 renderer를 도구별로 확인한다.

- 최종 통합에서만 실제 기존 프로젝트를 재설치한다.
  - old CLI `uninstall`
  - new CLI `init`
  - optional `spec-lifecycle` pack 설치
  - agent runtime에서 로딩 확인

## 가정과 기본값

- 첫 breaking release는 root project operating layer만 설치한다. monorepo workspace별 override는 후속 개선으로 둔다.
- `personal-context`와 `diagram-tools`는 context pack이 아니다. 필요하면 별도 global utility skill로만 관리한다.
- `docs/specs/`는 optional이지만, 설치되면 위치를 바꾸지 않는다.
- project-specific 지식은 skill에 복사하지 않고 `docs/agent`, `docs/business`, `docs/specs`에 기록한다.
- 기존 manifest 자동 마이그레이션은 하지 않는다.
