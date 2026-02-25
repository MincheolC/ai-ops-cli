# Phase 2-B-9: recommended-libraries YAML 3개 구현

## Context

Phase 2-B-8까지 11개 Rule YAML 완성 (priority: 90~30). 이번 Phase에서 **스택별 추천 라이브러리 규칙**을 3개 YAML로 신규 작성. TUI에서 서비스 유형(웹/앱/백엔드) 선택 시 해당 YAML만 적용하기 위해 스택별 분리. 각 YAML은 독립 완결 — 크로스커팅 라이브러리(date-fns 등)는 중복 허용.

기존 framework rule(nestjs.yaml, flutter.yaml 등)이 **HOW**(사용 패턴)를 다룬다면, 이 rule들은 **WHICH**(어떤 라이브러리를 선택할지) + **WHY NOT**(피해야 할 대안)에 집중.

버전 전략: 라이브러리명 + 최소 메이저 버전만 명시. 실제 핀닝은 프로젝트 package.json/pubspec.yaml에서 관리.

---

## Metadata

| 파일                     | id                  | category  | tags                                        | priority |
| ------------------------ | ------------------- | --------- | ------------------------------------------- | -------- |
| `libs-backend.yaml`      | `libs-backend`      | `tooling` | `typescript`, `nestjs`, `backend`           | **25**   |
| `libs-frontend-web.yaml` | `libs-frontend-web` | `tooling` | `typescript`, `react`, `nextjs`, `frontend` | **20**   |
| `libs-frontend-app.yaml` | `libs-frontend-app` | `tooling` | `dart`, `flutter`, `frontend`               | **15**   |

---

## libs-backend.yaml

### constraints (6개)

1. moment.js/dayjs 금지 → date-fns 4+ (tree-shakeable, immutable, functional API)
2. jsonwebtoken 금지 → jose 6+ (Web Crypto, edge-compatible, no native deps)
3. NestJS 내 express 직접 사용 금지 → platform adapter 통해 사용
4. lodash 풀 번들 금지 → 개별 import 또는 native JS (structuredClone, Object.groupBy 등) 우선
5. node-fetch/got 금지 → @nestjs/axios (HttpModule) 또는 native fetch()
6. winston/morgan 금지 → pino 9+ (nestjs-pino 4+). JSON 직렬화 성능 최고, NestJS Logger 완전 대체

### guidelines (11개)

1. class-validator 0.14+ / class-transformer 0.5+ — DTO 검증·직렬화
2. @nestjs/graphql 13+ / @nestjs/apollo 13+ / @apollo/server 5+ — GraphQL API
3. @graphql-codegen/cli 6+ / client-preset 5+ — 타입 안전 GraphQL 오퍼레이션
4. date-fns 4+ / date-fns-tz 3+ — 날짜 조작·타임존 (개별 함수 import)
5. jose 6+ — JWT 서명·검증·JWK/JWKS
6. pino 9+ / nestjs-pino 4+ — 구조화 JSON 로깅. NestJS Logger를 pino로 교체하여 전 모듈 자동 적용
7. rxjs 7+ — NestJS interceptor/guard/event stream 리액티브 패턴
8. vitest 4+ / @nestjs/testing / supertest 7+ — 테스트. ESM 네이티브, ts-jest/@swc/jest 불필요
9. pg 8+ / @prisma/adapter-pg 7+ — Prisma driver adapter (pool 설정 명시)
10. typescript 5+ strict / @swc/core — 타입 체크 + 빠른 트랜스파일
11. axios (via @nestjs/axios HttpModule) — 외부 HTTP 호출 (인터셉터/재시도 필요 시)

### decision_table (5개)

1. JWT 인증 필요 → jose 6+ | avoid: jsonwebtoken
2. 날짜 조작 → date-fns 4+ 개별 import | avoid: moment.js, dayjs
3. 유틸 함수 필요 → native JS 우선, 없으면 lodash 개별 import | avoid: lodash 풀 import
4. 비-DTO 스키마 검증 → zod | avoid: joi, 수동 type guard
5. 구조화 로깅 → pino 9+ (nestjs-pino) | avoid: winston (JSON 직렬화 느림), morgan (HTTP만), console.log

---

## libs-frontend-web.yaml

### constraints (6개)

1. moment.js/dayjs 금지 → date-fns 4+ 단일 표준화
2. react-icons 금지 → lucide-react (일관된 디자인, tree-shakeable)
3. 클라이언트 axios 금지 → native fetch() (Next.js 캐싱/revalidation 통합)
4. 수동 CSS class 조건문 금지 → cn() (clsx + tailwind-merge) + cva
5. shadcn/ui 외 추가 UI 라이브러리(MUI, Ant, Chakra) 설치 금지
6. Redux/Recoil/MobX 금지 → 순수 UI 상태는 zustand 4+ (서버 상태는 Apollo Client가 관리)

### guidelines (13개)

1. @apollo/client 4+ / @apollo/experimental-nextjs-app-support 0.13+ — App Router GraphQL
2. @graphql-codegen/cli 6+ / client-preset 5+ — 타입 안전 GraphQL
3. tailwindcss 4+ — 스타일링, CSS 변수 디자인 토큰
4. clsx 2+ / tailwind-merge 3+ — cn() 유틸
5. class-variance-authority 0.7+ — 다중 variant 컴포넌트 스타일링
6. zustand 4+ — 클라이언트 UI 상태 관리 (모달, 다단계 폼, 사이드바 등). 서버 상태는 Apollo Client에 위임
7. next-intl 4+ — i18n (서버 컴포넌트 메시지 로드, useTranslations 훅)
8. next-themes — 다크/라이트 모드 테마
9. recharts 2+ — 데이터 시각화 ("use client" 바운더리 필수)
10. sonner — 토스트 알림 (root layout Toaster)
11. date-fns 4+ — 날짜 포맷·조작 (개별 함수 import)
12. isomorphic-dompurify — UGC HTML 새니타이징 (dangerouslySetInnerHTML 전 필수)
13. vitest 4+ / @testing-library/react — 유닛·컴포넌트 테스트 (userEvent 우선). ESM 네이티브, 별도 트랜스파일러 불필요

### decision_table (6개)

1. App Router GraphQL 페칭 → @apollo/client + experimental-nextjs-app-support | avoid: urql, raw fetch
2. 날짜 조작 → date-fns 4+ | avoid: dayjs (프로젝트에서 제거, date-fns로 통일)
3. 아이콘 → lucide-react named import | avoid: react-icons, inline SVG
4. 폼 검증 → zod + react-hook-form (@hookform/resolvers/zod) | avoid: yup, 수동 검증
5. UGC HTML 렌더링 → isomorphic-dompurify 새니타이징 후 렌더 | avoid: 미새니타이징 렌더링
6. 클라이언트 UI 상태 (모달, 위자드 등) → zustand store | avoid: Redux, Recoil. 단, 단일 컴포넌트 내 상태는 useState로 충분

---

## libs-frontend-app.yaml

### constraints (5개)

1. http 패키지 금지 → dio 5+ (인터셉터, 재시도, 취소, multipart)
2. Provider/Bloc 금지 → flutter_riverpod 2+ (riverpod_annotation + riverpod_generator)
3. 수동 데이터 클래스(==, hashCode, copyWith, toJson) 금지 → freezed 2+
4. Navigator 1.0 (push/pop) 금지 → go_router 14+
5. dart:convert 수동 JSON 직렬화 금지 → json_annotation 4+ / json_serializable 6+ (또는 freezed)

### guidelines (11개)

1. flutter_riverpod 2+ / riverpod_annotation 2+ / riverpod_generator 2+ — 상태 관리
2. freezed 2+ / freezed_annotation 2+ — 불변 데이터 모델
3. go_router 14+ — 선언적 라우팅 (context.go()/context.push())
4. dio 5+ — HTTP 네트워킹 (base URL, 인터셉터, 타임아웃을 중앙 Dio 인스턴스로)
5. shared_preferences 2+ — 단순 KV 저장 / flutter_secure_storage 9+ — 민감 데이터
6. cached_network_image 3+ — 네트워크 이미지 캐싱·플레이스홀더. Image.network 대신 사용하여 메모리 효율과 오프라인 캐시 확보
7. json_annotation 4+ / json_serializable 6+ — JSON 코드 제너레이션
8. build_runner 2+ — 코드 생성 오케스트레이터 (dev: watch, CI: build --delete-conflicting-outputs)
9. mocktail 1+ — 테스트 모킹 (코드 생성 불필요, Dart-native 문법)
10. very_good_analysis 7+ — 엄격한 린트 (CI에서 warning=error)
11. intl 0.19+ 또는 easy_localization 3+ — i18n (ARB 파일 기반)

### decision_table (5개)

1. HTTP API 호출 → dio 5+ 중앙 인스턴스 (Riverpod DI) | avoid: http, raw HttpClient
2. 로컬 저장 → shared_preferences (비민감) / flutter_secure_storage (토큰) | avoid: SQLite/Hive (단순 KV에 과잉)
3. 네트워크 이미지 표시 → cached_network_image 3+ (자동 디스크/메모리 캐시, placeholder/errorWidget) | avoid: Image.network (캐시 없음, 메모리 낭비)
4. 테스트 모킹 → mocktail 1+ | avoid: mockito (코드 생성 필요, 보일러플레이트 많음)
5. 코드 생성 → build_runner 2+ (watch 모드 개발, CI build) | avoid: 생성 코드 수동 구현

---

## 수정 대상 파일

| 파일                                                        | 작업                            |
| ----------------------------------------------------------- | ------------------------------- |
| `packages/compiler/data/rules/libs-backend.yaml`            | **새로 생성**                   |
| `packages/compiler/data/rules/libs-frontend-web.yaml`       | **새로 생성**                   |
| `packages/compiler/data/rules/libs-frontend-app.yaml`       | **새로 생성**                   |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 3개 추가 |

## 참조 파일

| 파일                                                | 용도                 |
| --------------------------------------------------- | -------------------- |
| `packages/compiler/src/schemas/rule.schema.ts`      | Zod 스키마 검증 대상 |
| `packages/compiler/data/rules/code-philosophy.yaml` | 원칙 정합성 확인     |

---

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 14개 rule YAML 스키마 검증 통과
- id 유일성 (14개) 통과
- priority 유일성 (14개) 통과
