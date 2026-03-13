# Implementation Playbook

이 문서는 `docs/plan.md`의 현재 계약을 실제 구현/운영 작업으로 옮기기 위한 실행 플레이북이다.

## 1. 문서 역할 분리

- `docs/plan.md`: 재구현 가능한 현재 기능 사양
- `docs/implementation-playbook.md`: 구현 순서, 운영 절차, 릴리즈 전 검증 순서

## 2. 구현 순서

### Phase 1: Core contracts

1. `RuleSchema`, `SkillFrontmatterSchema`, `ManifestSchema`, `SkillRegistrySchema`를 먼저 고정한다.
2. 스키마 실패 케이스 테스트를 먼저 작성한다.
3. compiler `sourceHash`와 project manifest/global registry builder를 구현한다.

완료 기준:

- malformed YAML/frontmatter/JSON이 명확한 에러로 차단됨
- manifest와 registry가 항상 UTC timestamp와 6-char hash를 가짐
- reference-skill rule은 `reference_skill_id` 없이 통과하지 않음

### Phase 2: Deterministic data pipeline

1. loader 구현(`loadAllRules`, `loadAllSkills`, `loadPresets`, preset bundle 확장)
   - `loadAllSkills`는 `apps/cli/data/skills/<skill-id>/SKILL.md` frontmatter를 읽고 file tree를 수집한다.
2. deterministic ordering 보장(file sort + priority desc)
3. reference skill 추론(`resolveReferenceSkills`) 구현
4. core renderer 구현(global/domain 분리 + excerpt rendering)
5. skill renderer 구현(tool path mapping + source directory tree copy plan 생성)

완료 기준:

- 같은 입력에서 항상 같은 rule/skill 렌더 결과 생성
- Codex/Gemini는 `.agents/skills`, Claude는 `.claude/skills` 경로 계약이 테스트로 고정됨
- reference skill rule은 코어 문서에서 full body가 아닌 excerpt만 렌더됨
- reference skill 상세 본문은 `references/reference.md`에만 존재함

### Phase 3: Managed lifecycle

1. managed section 유틸 구현(`wrap`, `replace`, `strip`, `parse meta`)
2. project rule install 구현(new/write, managed replace, non-managed append)
3. skill package install 구현(directory replace)
4. uninstall 구현(rule file delete/clean + skill directory remove)
5. manifest/global registry I/O 구현

완료 기준:

- 사용자 파일 본문이 파손되지 않음
- uninstall이 rule은 managed section 기준으로, skill은 루트 디렉토리 기준으로 안전하게 동작함
- project state와 user/global state가 분리 저장됨

### Phase 4: Command orchestration

1. `init` 구현(프롬프트 + rule 렌더 + reference skill 설치 + manifest 저장)
2. `diff` 구현(project manifest + compiler sourceHash 기반 비교)
3. `update` 구현(diff gate + rule/skill 재설치 + manifest 갱신)
4. `uninstall` 구현(대상 계산 + confirm + 삭제 + manifest 제거)
5. `skill list/install/diff/update/uninstall` 구현(scope별 저장소 읽기/쓰기)

완료 기준:

- project 명령과 skill 명령의 책임 경계가 분명함
- `ai-ops skill`은 기본 user scope로 동작하고 `--project`로 local 설치 가능
- manifest 없음, registry 없음, 파일 누락 케이스가 안전하게 처리됨

### Phase 5: Verification and docs

1. README와 package README에 skill 사용법과 local verification 절차 반영
2. `apps/cli/data/skills/README.md`에 skill authoring contract 유지
3. `skill-load-check` 샘플 skill을 이용한 manual verification 절차 문서화
4. build/test/subprocess 검증 수행

완료 기준:

- 로컬에서 `console.log('A Skill loaded')`까지 검증 가능한 문서가 존재함
- `AI_OPS_HOME`을 사용한 격리된 user scope 검증 절차가 README에 정리됨
- dist 기준 subprocess 테스트가 통과함
- skill authoring guide와 parser contract가 서로 모순되지 않음

## 3. 엣지 케이스 점검표

- manifest가 없을 때 `diff/update/uninstall`은 종료 코드 1로 실패
- skill registry가 없을 때 user scope `skill list/diff/update/uninstall`은 안전하게 빈 상태를 처리
- 기존 파일이 managed 섹션이 없으면 append 모드로 진입
- legacy header 파일은 update 시 새 포맷으로 마이그레이션
- uninstall 대상 rule 파일이 이미 없으면 `notFound`로 처리
- user scope skill은 `AI_OPS_HOME ?? HOME` 기준으로 설치
- Codex와 Gemini를 함께 선택해도 `.agents/skills/<skill-id>`는 하나만 설치
- unsupported scope/tool 요청은 명확한 에러로 거부
- settings JSON 파싱 실패 시 uninstall은 삭제 fallback
- 모노레포 workspace 후보 탐색 시 숨김/빌드 디렉토리 제외

## 4. 테스트 실행 순서

저장소 루트 기준:

```bash
npm install
npm run build
npm run compile
npm test
```

문서/코드 정합 검증:

- README 명령/옵션/경로 표기가 코드와 일치하는지 확인
- `docs/plan.md`의 계약(`.ai-ops-manifest.json`, `~/.ai-ops/skills-manifest.json`, tool output paths)이 구현과 일치하는지 확인
- `apps/cli/data/skills/README.md`의 frontmatter 표와 실제 parser contract가 일치하는지 확인

## 5. 로컬 skill 검증 절차

배포 전 최소 검증:

```bash
npm run build
export AI_OPS_HOME="$(mktemp -d)"
node apps/cli/dist/bin/index.js skill install skill-load-check --tool codex
find "$AI_OPS_HOME/.agents/skills/skill-load-check" -maxdepth 2 -type f | sort
node "$AI_OPS_HOME/.agents/skills/skill-load-check/scripts/loaded.js"
```

기대 결과:

- `SKILL.md`, `scripts/loaded.js`가 생성됨
- 스크립트 실행 시 `A Skill loaded` 출력

project scope 검증:

```bash
node apps/cli/dist/bin/index.js skill install skill-load-check --project --tool codex
find ./.agents/skills/skill-load-check -maxdepth 2 -type f | sort
node ./.agents/skills/skill-load-check/scripts/loaded.js
```

추가 확인:

- tool session이 skill discovery를 캐시하면 재시작 후 metadata discovery 재확인
- 필요 시 `ai-ops skill diff`, `ai-ops skill uninstall`까지 한 번 더 실행

## 6. 릴리즈 전 체크리스트

- `apps/cli/package.json` 버전/메타데이터 확인
- CLI 도움말과 README 표면 동기화 확인
- 전체 테스트 통과 확인
- dist subprocess 기반 skill 명령 검증 확인
- 문서 링크와 예제 명령이 깨지지 않는지 확인

## 7. 운영 원칙

- 기능 계약 변경 시 `docs/plan.md`를 먼저 업데이트한 뒤 코드 변경
- 구현 절차/검증 순서 변경 시 `docs/implementation-playbook.md` 업데이트
- README는 사용자 표면과 검증 절차를 유지하고, 내부 세부 계약은 plan/playbook으로 위임
