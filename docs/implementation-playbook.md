# 구현 플레이북

이 문서는 [docs/plan.md](/Users/charles/ai-projects/ai-ops-scaffolder/docs/plan.md)의 계약을 실제 구현 순서와 점검 절차로 옮긴 실행 가이드다.

## 1. 구현 순서

### Phase 1: 핵심 계약

1. `RuleSchema`는 항상 로드되는 general rule만 다루도록 유지한다.
2. `SkillFrontmatterSchema`는 공통 필수 필드만 검증하고, tool-specific frontmatter 추가 필드는 허용한다.
3. `ManifestSchema`와 `SkillRegistrySchema`를 각각 project 상태와 user 상태의 경계로 유지한다.
4. `sourceHash`와 installed skill hash 계산은 테스트로 먼저 고정한다.

완료 기준:

- 잘못된 YAML/frontmatter/JSON이 명확하게 실패한다
- project/user 상태 파일에는 항상 UTC timestamp가 기록된다
- Claude invocation flag 같은 추가 필드가 skill parsing을 깨뜨리지 않는다

### Phase 2: 결정적 데이터 로딩

1. core rules는 `apps/cli/data/rules/*.yaml`에서 로드한다.
2. skills는 `apps/cli/data/skills/<skill-id>/` 디렉토리를 순회해서 로드한다.
3. presets는 `apps/cli/data/presets.yaml`에서 `rules[] + skills[]` 구조로 파싱한다.
4. 파일, 디렉토리, priority 순서를 결정적으로 유지한다.

완료 기준:

- 같은 source tree에서 항상 같은 compiler 출력이 나온다
- YAML rule로 로드되는 것은 core 5개뿐이다
- skill은 디렉토리 source를 그대로 복사하며, 본문을 생성하지 않는다

### Phase 3: 렌더링과 생명주기

1. 도구별 core rule 파일을 렌더링한다.
2. skill 전체 트리를 복사하는 install plan을 만든다.
3. managed section을 이용해 core rule 파일을 설치한다.
4. 전용 디렉토리 교체 방식으로 skill을 설치한다.
5. project skill은 `.ai-ops-manifest.json`, user skill은 `~/.ai-ops/skills-manifest.json`에 추적한다.

완료 기준:

- managed section 밖의 사용자 작성 내용이 보존된다
- skill 디렉토리는 단위 전체로 안전하게 교체/삭제할 수 있다
- Codex/Gemini는 `.agents/skills`, Claude는 `.claude/skills`를 사용한다

### Phase 4: 명령 오케스트레이션

1. `init`은 presets를 로드하고, 잠긴 core rules를 보여준 뒤, recommended skills를 조정하고, 마지막에 공통 skill scope 하나를 묻는다.
2. `skill install/list/diff/update/uninstall`은 skill 자체 lifecycle만 관리한다.
3. `diff/update/uninstall`은 project-managed 상태만 다룬다.
4. `diff/update`는 오래된 rule id가 아니라 저장된 preset/workspace 선택에서 현재 core rules를 다시 계산한다.
5. `diff/update`는 필요할 경우 legacy externalized rule id를 현재 project skills로 마이그레이션한다.

완료 기준:

- `init`은 recommended skills를 `user` 또는 `project`에 설치할 수 있다
- `ai-ops uninstall`은 user-scope skill을 절대 삭제하지 않는다
- legacy manifest도 새 모델로 문제없이 업데이트된다

### Phase 5: 검증과 문서

1. `apps/cli/data/skills/README.md`가 실제 parser와 copy behavior를 정확히 설명하도록 유지한다.
2. 패키지 README가 현재 CLI UX와 맞도록 유지한다.
3. plan/playbook 문서가 실제 구현 계약과 일치하도록 유지한다.
4. 데이터 모델이나 lifecycle 변경 후에는 build/test를 다시 실행한다.

완료 기준:

- authoring 문서가 실제 런타임 동작과 일치한다
- skill invocation metadata 가이드가 각 도구의 실제 관례와 맞는다
- 자동화 테스트가 모두 통과한다

## 2. 엣지 케이스

- manifest가 없으면 `diff/update/uninstall`은 종료 코드 `1`로 실패해야 한다
- global registry가 없으면 user-scope skill 명령은 빈 상태로 취급해야 한다
- 지원하지 않는 requested tool은 명시적으로 실패해야 한다
- 지원하지 않는 scope는 명시적으로 실패해야 한다
- 기존 skill 디렉토리가 있으면 디렉토리 단위로 교체해야 한다
- 기존 managed rule section이 있으면 managed content만 교체해야 한다
- 삭제된 stack rule id를 가진 legacy manifest는 `diff/update` 중 현재 skill로 매핑해야 한다
- 모노레포에서 중복 추천된 skill은 설치 전에 dedupe해야 한다
- `init`에서 `user` scope로 선택된 skill은 project manifest가 아니라 global registry에만 기록해야 한다

## 3. 테스트 순서

저장소 루트 기준:

```bash
npm install
npm run build
npm run compile
npm test
```

CLI workspace만 집중 확인할 때:

```bash
npm run build --workspace=apps/cli
npm run test --workspace=apps/cli
```

## 4. 로컬 skill 검증

npm publish 전에 `skill-load-check`로 수동 검증한다.

Global scope:

```bash
npm run build
export AI_OPS_HOME="$(mktemp -d)"
node apps/cli/dist/bin/index.js skill install skill-load-check --tool codex
find "$AI_OPS_HOME/.agents/skills/skill-load-check" -maxdepth 2 -type f | sort
node "$AI_OPS_HOME/.agents/skills/skill-load-check/scripts/loaded.js"
```

기대 결과:

```text
A Skill loaded
```

Project scope:

```bash
node apps/cli/dist/bin/index.js skill install skill-load-check --project --tool codex
find ./.agents/skills/skill-load-check -maxdepth 2 -type f | sort
node ./.agents/skills/skill-load-check/scripts/loaded.js
```

그 다음 실제 도구 discovery는 수동으로 확인한다.

- skill discovery를 캐시하는 도구라면 세션을 재시작한다
- `skill-load-check`가 트리거될 만한 프롬프트를 넣는다
- 도구가 설치된 skill metadata를 인식하고 의도한 워크플로우를 실행하는지 확인한다

## 5. 운영 규칙

- 계약이 바뀌면 먼저 [docs/plan.md](/Users/charles/ai-projects/ai-ops-scaffolder/docs/plan.md)를 수정한다
- 롤아웃 절차나 검증 절차가 바뀌면 이 플레이북을 수정한다
- 내부 마이그레이션 규칙은 중복 데이터 파일이 아니라 코드에 둔다
