# npm 첫 배포 + 글로벌 설치 테스트 계획

## Context

`@ai-ops/compiler`와 `@ai-ops/cli` 두 패키지를 npm에 처음 배포. org 없이 unscoped 패키지(`ai-ops-compiler`, `ai-ops-cli`)로 배포. 배포 후 별도 테스트 레포에서 글로벌 설치하여 검증까지 수행.

## 현재 상태 & 변경 필요 사항

- 빌드/배포 설정 대부분 완료 (publishConfig, files, bin, tsup)
- **변경 필요:**
  - 패키지명: `@ai-ops/compiler` → `ai-ops-compiler`, `@ai-ops/cli` → `ai-ops-cli`
  - cli의 compiler 의존성: `"*"` → `"^0.1.0"`으로 변경 + 이름도 `ai-ops-compiler`로
  - `publishConfig.access: "public"` 제거 (unscoped는 기본 public)
  - 두 패키지 모두 `license`, `description`, `engines` 필드 없음
  - `apps/cli/README.md` 없음, 루트 LICENSE 없음

---

## TODO 1: npm 계정 준비

- [x] npm 계정이 없으면 https://www.npmjs.com/signup 에서 생성
- [x] `npm login` 실행 → 브라우저 인증
- [x] `npm whoami`로 로그인 확인
- [x] 이름 충돌 확인: `npm view ai-ops-compiler` / `npm view ai-ops-cli` → 404면 사용 가능

## TODO 2: package.json 수정

### `packages/compiler/package.json`

- [x] `name`: `"@ai-ops/compiler"` → `"ai-ops-compiler"`
- [x] `description` 추가
- [x] `license: "MIT"` 추가
- [x] `engines: { "node": ">=18" }` 추가
- [x] `publishConfig` 제거 (불필요)

### `apps/cli/package.json`

- [x] `name`: `"@ai-ops/cli"` → `"ai-ops-cli"`
- [x] `description` 추가
- [x] `license: "MIT"` 추가
- [x] `engines: { "node": ">=18" }` 추가
- [x] `publishConfig` 제거
- [x] `dependencies`의 `"@ai-ops/compiler": "*"` → `"ai-ops-compiler": "^0.1.0"`

### 코드 내 import 경로 수정

- [x] cli 소스 코드에서 `@ai-ops/compiler` import를 `ai-ops-compiler`로 변경
- [x] tsup.config.ts의 external 배열에서도 변경

### 기타 파일

- [x] `apps/cli/README.md` 생성
- [x] 루트 `LICENSE` 파일 생성 (MIT)

## TODO 3: 배포 전 검증

- [x] `npm run build` — 빌드 정상 확인
- [x] `npm run test` — 전체 테스트 통과 확인
- [x] `cd packages/compiler && npm pack --dry-run` — 배포 파일 목록 확인
- [x] `cd apps/cli && npm pack --dry-run` — 배포 파일 목록 확인

## TODO 4: npm 배포 (compiler → cli 순서)

- [x] `cd packages/compiler && npm publish`
- [x] `npm view ai-ops-compiler` → 배포 확인
- [x] `cd apps/cli && npm publish`
- [x] `npm view ai-ops-cli` → 배포 확인

## TODO 5: 글로벌 설치 & CLI 테스트

- [ ] `npm install -g ai-ops-cli`
- [ ] `ai-ops --help` 동작 확인
- [ ] `ai-ops` 기본 명령 실행 확인
- [ ] 테스트 프로젝트 폴더에서 `ai-ops` 실행 → rules 생성 확인

## TODO 6: 별도 테스트 레포에서 라이브러리 검증

- [ ] `mkdir /tmp/ai-ops-test && cd /tmp/ai-ops-test && npm init -y`
- [ ] `npm install ai-ops-compiler`
- [ ] test.mjs 작성:
  ```js
  import { ... } from 'ai-ops-compiler';
  // compiler 함수 호출 테스트
  ```
- [ ] `node test.mjs` 실행 → 정상 동작 확인
- [ ] 테스트 완료 후 정리: `rm -rf /tmp/ai-ops-test`

## TODO 7: 문제 발생 시

- `npm unpublish ai-ops-패키지명@0.1.0` (72시간 이내만 가능)
- 수정 후 재배포: version `0.1.1`로 올린 뒤 publish
- **같은 버전은 재배포 불가**

---

## 주의사항

1. **배포 순서**: compiler → cli (의존성 방향)
2. **2FA**: npm 계정에 2FA 설정 시 publish할 때 OTP 입력 필요
3. **dry-run으로 반드시 사전 확인** — 한번 배포한 버전은 덮어쓸 수 없음
4. **workspace 내부 의존성**: 로컬 개발 시 workspace 프로토콜 대신 실제 버전을 사용하므로, `npm install`이 registry에서 가져올 수 있음 — 로컬 개발 시에는 `npm link` 활용
