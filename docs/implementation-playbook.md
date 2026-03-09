# Implementation Playbook

이 문서는 `docs/plan.md`(마스터 사양)를 실제 구현/운영 작업으로 옮기기 위한 실행 플레이북이다.

## 1. 문서 역할 분리

- `docs/plan.md`: 재구현 가능한 기능 사양(what + why + invariant)
- `docs/implementation-playbook.md`: 실제 구현 순서, 점검 항목, 운영 절차(how)

## 2. 구현 순서

### Phase 1: Core contracts

1. `RuleSchema`, `PresetSchema`, `ManifestSchema`를 먼저 고정한다.
2. 스키마 실패 케이스 테스트를 먼저 작성한다.
3. `sourceHash`와 manifest builder를 구현한다.

완료 기준:

- malformed YAML/JSON이 명확한 에러로 차단됨
- manifest가 항상 UTC timestamp와 6-char hash를 가짐

### Phase 2: Deterministic data pipeline

1. loader 구현(`loadAllRules`, `loadPresets`, preset bundle 확장)
2. deterministic ordering 보장(file sort + priority desc)
3. renderer 구현(global/domain 분리 + tool path mapping)

완료 기준:

- 같은 입력에서 항상 같은 렌더 결과
- 도구별 경로 계약이 테스트로 고정됨

### Phase 3: Managed file lifecycle

1. managed section 유틸 구현(`wrap`, `replace`, `strip`, `parse meta`)
2. install 구현(new/write, managed replace, non-managed append)
3. uninstall 구현(delete vs clean 분기)

완료 기준:

- 사용자 파일 본문이 파손되지 않음
- uninstall이 managed 블록만 제거 가능

### Phase 4: Command orchestration

1. `init` 구현(프롬프트 + 렌더 + 설치 + manifest 저장)
2. `diff` 구현(manifest + sourceHash 기반 비교)
3. `update` 구현(diff gate + 재설치 + manifest 갱신)
4. `uninstall` 구현(대상 계산 + confirm + 삭제 + manifest 제거)

완료 기준:

- 4개 명령이 project-only 정책으로 일관 동작
- manifest 없음/취소/파일 누락 케이스가 안전하게 처리됨

## 3. 엣지 케이스 점검표

- manifest가 없을 때 `diff/update/uninstall`은 종료 코드 1로 실패
- 기존 파일이 managed 섹션이 없으면 append 모드로 진입
- legacy header 파일은 update 시 새 포맷으로 마이그레이션
- uninstall 대상 파일이 이미 없으면 `notFound`로 처리
- settings JSON 파싱 실패 시 uninstall은 삭제 fallback
- 모노레포에서 workspace 후보 탐색 시 숨김/빌드 디렉토리 제외

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
- `docs/plan.md`의 계약(`.ai-ops-manifest.json`, tool output paths)이 구현과 일치하는지 확인

## 5. 릴리즈 전 체크리스트

- `apps/cli/package.json` 버전/메타데이터 확인
- CLI 도움말과 README 표면 동기화 확인
- 테스트 통과 확인
- 문서 링크 깨짐 여부 확인

## 6. 운영 원칙

- 기능 변경 시 `docs/plan.md`를 먼저 업데이트한 뒤 코드 변경
- 구현 세부 절차 변경 시 `docs/implementation-playbook.md` 업데이트
- README는 사용자 표면만 유지하고 내부 세부는 plan/playbook으로 위임
