# Work Packet Template

```md
# 001 패킷 제목

## 목표

- 이번 패킷이 끝나면 무엇이 가능해져야 하는가
- foundation 패킷이면 이후 기능 패킷이 실제 repo 위에서 시작 가능해야 한다.

## 범위

- 포함되는 변경 범위
- 설치, scaffold, config, env wiring만 다루는 foundation 패킷인지 여부를 명확히 적는다.

## 입력물

- `./docs/specs/baseline/05_technical-context.md`
- `./docs/specs/baseline/10_product-spec.md`
- 필요 시 `./docs/specs/baseline/20_ui-spec.md`
- 필요 시 `./docs/specs/baseline/22_stitch-assets/...`
- 필요 시 `./docs/specs/baseline/22_stitch-assets/DESIGN.md`
- 필요 시 `./docs/specs/baseline/24_design-tokens.md`
- 현재 repo의 관련 manifest / config / app 디렉터리 상태 (`package.json`, `pubspec.yaml`, `next.config.*`, `nest-cli.json`, `prisma/schema.prisma` 등)

## 산출물

- 기대 결과물
- foundation 패킷이면 생성되거나 정리될 scaffold, config, dependency install 결과를 적는다.

## 대상 파일 / 모듈

- 수정 또는 생성 대상
- 필요 시 `package.json`, lockfile, `pubspec.yaml`, `next.config.*`, `tailwind.config.*`, `components.json`, `nest-cli.json`, `src/main.ts`, `prisma/schema.prisma`, `apps/*`, `packages/*`, `lib/*` 같은 기반 파일을 명시한다.

## 승인 기준

- 기준 1
- 기준 2
- foundation 패킷이면 이후 패킷이 가정하는 framework scaffold와 dependency wiring이 repo에 실제로 존재해야 한다.
- foundation 패킷이면 최소 한 가지 smoke 검증 기준을 넣는다. 예: install 성공, dev boot 성공, schema generation 성공.
- UI 패킷이면 `20_ui-spec.md`와 initial visual guidance에서 승인된 화면 구조, CTA 우선순위, 상태 표현, 주요 인터랙션을 target platform에 맞게 보존해야 한다.
- 헤드리스 / 백엔드 패킷이면 화면 문서를 새로 만들지 않고 계약, 데이터 흐름, 운영 동작 기준으로 검증 가능해야 한다.

## 보안 검토

- 판정: 필요 / 불필요 / 확인 필요
- 트리거: auth / 권한 / 민감정보 / 업로드 / 외부 호출 / raw query / 렌더링 / tenant 경계 / 삭제 동작 중 해당 사항
- 구현 후 리뷰 조건: 필요 없으면 `없음`

## 테스트

- 테스트 1
- 테스트 2
- foundation 패킷이면 smoke test, install verification, scaffold verification, generated file presence 중 최소 하나를 넣는다.

## 의존성

- 선행 패킷: 없음 / `000_repo-bootstrap` / `001_xxx`
- 외부 결정 / 선행 계약: 없으면 `없음`
- 병렬 가능 후보: 없으면 `없음`

## 범위 제외

- 이번 패킷에서 다루지 않을 것
- foundation 패킷이면 실제 기능 구현, 세부 UI 완성, 비즈니스 로직은 범위 제외로 분리한다.
```
