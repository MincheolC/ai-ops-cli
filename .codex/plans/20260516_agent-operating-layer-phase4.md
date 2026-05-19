# Phase 4 구현 계획: Optional `docs/specs/` Pack

## 요약

Phase 4는 root `specs/` scaffolding을 제거하고, project operating layer 위에 optional `spec-lifecycle` pack을 설치하는 모델로 전환한다. pack은 반드시 기존 `.ai-ops/manifest.json`이 있는 프로젝트에서만 동작한다.

공개 CLI는 다음을 추가한다.

```text
ai-ops pack list
ai-ops pack install spec-lifecycle
ai-ops pack diff [pack-id]
ai-ops pack update [pack-id]
ai-ops pack uninstall <pack-id>
```

기존 `ai-ops spec init`은 public CLI에서 제거한다.

## 구현 변경

- `spec-lifecycle` pack data source를 추가한다.
  - 새 루트: `apps/cli/data/packs/spec-lifecycle/`
  - 설치 위치는 `docs/specs/`로 고정한다.
  - 기본 생성:
    - `docs/specs/README.md`
    - `docs/specs/baseline/.gitkeep`
    - `docs/specs/initial-build/.gitkeep`
  - `README.md`는 frontmatter 포함 `Reserved` 문서로 만들고, “판단 근거로 사용하지 마세요” 문구를 포함한다.
  - `.gitkeep` 파일은 context document가 아니므로 context-layer index와 docs-status에는 넣지 않는다.

- pack 상태를 project manifest에 기록한다.
  - `ProjectLayerManifestSchema`에 `packs`를 추가한다.
  - pack record는 `id`, `sourceHash`, `documents`, `files`, `installedAt`을 가진다.
  - `documents`는 frontmatter/audit 대상 Markdown만 기록한다.
  - `files`는 `.gitkeep` 같은 일반 pack file만 기록한다.
  - pack install/update/uninstall은 `.ai-ops/context-layer.json`과 `docs/docs-status.md`를 함께 갱신한다.

- lifecycle 동작을 고정한다.
  - `pack install`은 `.ai-ops/manifest.json`이 없으면 실패하고 `ai-ops init`을 먼저 안내한다.
  - `pack install spec-lifecycle`은 이미 설치되어 있으면 update처럼 동작한다.
  - `pack update`는 unmodified pack-owned 파일만 갱신하고, 사용자가 수정한 `docs/specs/README.md`는 보존한다.
  - `pack uninstall`은 unmodified pack files만 제거하고, 수정된 `docs/specs/*`는 보존한다.
  - `audit`은 manifest에 기록된 pack document를 context-layer/docs-status와 함께 검사한다.

- spec lifecycle skills를 global task skill로 이관한다.
  - `spec-product-01-idea-to-brief`
  - `spec-product-02-brief-to-technical-context`
  - `spec-product-03-brief-to-product-spec`
  - `spec-product-04-product-spec-to-ui-spec`
  - `spec-product-05-spec-to-work-packets`
  - `spec-baseline-sync`
  - `project-terminology-sync`
  - 모두 `apps/cli/data/skills/task-skills/`로 복사하고 `skill-registry.json`에 `groups: ["spec-lifecycle"]`, `included_in_presets: []`로 등록한다.
  - 모든 output/input path는 root `./specs/...`에서 `./docs/specs/...`로 바꾼다.

- 문서와 기존 spec command를 정리한다.
  - `apps/cli/src/commands/spec.ts`, `spec-plan.ts`, 관련 old root `specs/` 테스트를 제거한다.
  - README 계열에는 `pack install spec-lifecycle` 사용법을 추가한다.
  - `docs/implementation-playbook.md`의 Phase 4 검증 예시는 `ai-ops init --tool codex` 후 `pack install spec-lifecycle`로 보정한다.

## 테스트 계획

- pack schema/loader
  - registry가 `spec-lifecycle`만 로드하고, 안전한 project-relative path만 허용한다.
  - pack Markdown document는 frontmatter와 Reserved warning을 검증한다.
  - `.gitkeep`은 document audit 대상에서 제외된다.

- pack lifecycle
  - `pack install spec-lifecycle`은 init 전에는 실패한다.
  - init 후 install하면 `docs/specs/README.md`, `baseline/.gitkeep`, `initial-build/.gitkeep`가 생성된다.
  - manifest `packs`와 context-layer index에 `docs/specs/README.md`가 기록된다.
  - docs-status에 `docs/specs/README.md | Reserved | project` row가 추가된다.
  - `pack update`는 수정된 README를 덮어쓰지 않는다.
  - `pack uninstall`은 unmodified pack files를 제거하고, 수정된 docs/specs 파일은 보존한다.

- skill 이관
  - 새 spec lifecycle task skills가 registry schema를 통과한다.
  - `rg './specs|specs/' apps/cli/data/skills/task-skills/spec-*` 결과에 root specs 경로가 남지 않아야 한다.
  - `AI_OPS_HOME="$(mktemp -d)" ai-ops skill install spec-product-01-idea-to-brief --tool codex`가 global skill 위치에만 설치되어야 한다.

- 전체 검증
  - `npm run check`
  - `npm run build`
  - `npm run compile`
  - 임시 디렉터리에서:
    - `ai-ops init --tool codex`
    - `ai-ops pack install spec-lifecycle`
    - `find docs/specs -maxdepth 3 -type f | sort`
    - `ai-ops audit`
    - `ai-ops pack uninstall spec-lifecycle`

## 가정과 기본값

- Phase 4는 `docs/specs/` pack과 spec lifecycle skills만 다룬다.
- `pack install`은 project operating layer를 자동 설치하지 않는다.
- root `specs/` 호환 옵션은 제공하지 않는다.
- spec lifecycle skills는 project repo에 복사하지 않고 global skill catalog에만 추가한다.
- 기존 `spec-to-packet` sync script와의 호환 마이그레이션은 만들지 않는다.
