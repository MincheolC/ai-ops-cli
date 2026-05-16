# Phase 2 구현 계획: Global Skill 모델 단순화

## 요약

Phase 2는 `skill` 명령을 global-only lifecycle로 전환한다. `docs/plan.md`와 `docs/implementation-playbook.md` 기준에 따라 project-local skill 설치, scope 선택, project manifest 연동을 제거한다.

Phase 2 완료 후 skill 관련 공개 표면은 다음처럼 단순해진다.

```text
ai-ops skill list
ai-ops skill install <skill-id> --tool <tool...>
ai-ops skill diff [skill-id]
ai-ops skill update [skill-id]
ai-ops skill uninstall <skill-id>
```

`--tool`은 유지하고, `--project`, `--global`, `--scope`는 제거한다.

## 구현 변경

- CLI 옵션 정리
  - `skill` 하위 명령에서 `--project`, `--global`, `--scope` 옵션을 제거한다.
  - `install`은 `--tool <tool...>`만 받는다.
  - `list/diff/update/uninstall`은 scope 옵션 없이 global registry만 읽는다.
  - `--project`, `--global`, `--scope`를 입력하면 commander의 unknown option으로 실패하게 둔다.

- skill command 리팩터링
  - `resolveScopeContext`, `writeProjectSkillState`, project manifest 읽기/쓰기 분기를 제거한다.
  - skill base path는 항상 `resolveUserBasePath()`다.
  - installed skill state는 항상 `~/.ai-ops/skills-manifest.json` 또는 `AI_OPS_HOME/.ai-ops/skills-manifest.json`만 사용한다.
  - project repo의 `.ai-ops/manifest.json`에는 skill metadata를 쓰지 않는다.
  - project repo에 `.agents/skills` 또는 `.claude/skills`를 만들지 않는다.

- skill schema/catalog 정리
  - `skill-registry.json`에서 `install_scopes` 필드를 제거한다.
  - `SkillCatalogSchema`와 `Skill` 타입에서 `install_scopes`를 제거한다.
  - `InstalledSkill`에서 `scope` 필드를 제거한다.
  - 기존 registry에 `scope`가 남아 있어도 `.strip()`으로 읽히게 하여 user registry는 깨지지 않게 한다.
  - `buildSkillInstallPlan`은 `scope` 파라미터를 받지 않고, `installed_paths`와 `sourceHash`만 계산한다.

- 문서 정리
  - `apps/cli/data/skills/README.md`에서 `install_scopes`와 project-scope authoring 설명을 제거한다.
  - `README.md`, `apps/cli/README.md`, `apps/cli/README.ko.md`에서 실제 사용법은 global-only skill 명령으로 갱신한다.
  - `--project`, `--global`, `--scope`는 deprecated/old model 설명 안에서만 남길 수 있다.
  - `docs/plan.md`와 `docs/implementation-playbook.md`는 이미 상위 계약이므로 필요한 경우 Phase 2 완료 상태에 맞춰 문구만 보정한다.

- 테스트 정리
  - project-scope skill 설치 e2e 테스트를 제거하거나 global-only 실패/부재 테스트로 교체한다.
  - `skill-state` 테스트에서 scope 해석 테스트를 제거하고, tool 선택/병합/삭제 테스트만 유지한다.
  - skill renderer 테스트에서 `scope` 기대값을 제거한다.
  - manifest-resolution의 project skill migration 테스트는 더 이상 Phase 2 계약에 맞지 않으므로 제거한다.

## 테스트 계획

- CLI help
  - `ai-ops skill install --help`에 `--tool`만 남고 `--project`, `--global`, `--scope`가 없어야 한다.
  - `ai-ops skill install skill-load-check --project`는 unknown option으로 실패해야 한다.

- global install smoke
  - `AI_OPS_HOME="$(mktemp -d)"`로 격리한다.
  - 별도 임시 cwd에서 `skill install skill-load-check --tool codex` 실행.
  - `AI_OPS_HOME/.agents/skills/skill-load-check`가 생성되어야 한다.
  - cwd 아래에는 `.agents/skills`, `.claude/skills`, `.ai-ops/manifest.json`가 생기지 않아야 한다.
  - `AI_OPS_HOME/.ai-ops/skills-manifest.json`만 skill 상태를 기록해야 한다.

- lifecycle
  - `skill list`는 global registry 상태만 표시한다.
  - `skill diff`는 global registry의 installed skills만 비교한다.
  - `skill update`는 global 설치 경로만 갱신한다.
  - `skill uninstall`은 global 설치 경로와 global registry만 제거한다.

- 전체 검증
  - `npm run check`
  - `npm run build`
  - `npm run compile`
  - 실제 사용자 홈을 오염시키지 않도록 모든 skill e2e는 `AI_OPS_HOME`을 사용한다.

## 가정과 기본값

- Phase 2는 skills만 다룬다. subagents는 Phase 3 범위다.
- Phase 2는 project operating layer 명령을 수정하지 않는다.
- `--tool`이 생략되면 현재처럼 해당 skill의 모든 supported tools에 설치한다.
- 기존 project-installed skill 자동 마이그레이션이나 정리는 제공하지 않는다.
- 기존 프로젝트 정리는 breaking policy에 따라 old CLI uninstall 후 new CLI init으로 처리한다.
