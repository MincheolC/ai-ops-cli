# Phase 2-B-8: flutter.yaml 구현

## Context

Phase 2-B-7까지 10개 Rule YAML 완성 (priority: 90~35).
이번 Phase에서 Flutter/Dart 컨벤션 규칙을 `flutter.yaml`로 신규 작성.

핵심 의도: AI가 Flutter 코드를 생성할 때 **Riverpod + freezed + GoRouter** 기반의 일관된 아키텍처를 따르도록 강제. code-philosophy.yaml의 일반 원칙(immutability, TDD, functional core)을 Dart/Flutter 문맥으로 구체화.

---

## 설계 결정

### Metadata

- **id:** `flutter`
- **category:** `framework` (nextjs, nestjs와 동일 레벨)
- **tags:** `dart`, `flutter`, `riverpod`, `mobile`
- **priority:** `30` (shadcn-ui=35 아래, 유일 값)

### constraints (6개)

1. **`dynamic` 타입 사용 금지** — `Object` 또는 `sealed class` + pattern matching 사용. TypeScript의 `any` 금지 규칙과 대응.
2. **Widget build()에 비즈니스 로직 금지** — Widget은 UI 선언만. 로직은 Notifier/Controller 또는 `*.logic.dart` 순수 함수로 분리. (Functional Core / Imperative Shell의 Flutter 적용)
3. **공유 상태에 StatefulWidget 금지** — 위젯 생명주기를 넘어서는 상태는 Riverpod provider 사용.
4. **GlobalKey로 위젯 상태 접근 금지** — provider 또는 callback props로 데이터 전달. 트리 캡슐화 보존.
5. **mutable class field 금지** — 모든 필드 `final`. freezed/copyWith로 데이터 클래스 업데이트.
6. **UI 스레드 블로킹 금지** — 대용량 JSON 파싱, 이미지 처리 등 무거운 동기 연산은 `compute` 함수나 별도 Isolate로 분리. Main Isolate에서 직접 실행 금지.

### guidelines (10개)

1. **Riverpod + code generation** — `@riverpod` 어노테이션 사용. provider는 소비하는 feature 디렉토리에 co-locate.
2. **Feature-first 구조** — `lib/features/<feature>/{view, model, provider, logic}`. 공유 코드는 `lib/core/`.
3. **sealed class + switch expression** — Dart 3의 union type 패턴. AsyncValue, Result 패턴에 활용.
4. **const constructor 우선** — 모든 widget/data class에 가능하면 const constructor. Framework rebuild 최적화 활성화.
5. **GoRouter 선언적 라우팅** — 정적 route 설정. imperative `Navigator.push()` 지양.
6. **freezed로 immutable data class** — copyWith, equality, JSON serialization 자동 생성. `==`/`hashCode` 수동 구현 금지.
7. **Widget test + ProviderScope override** — pumpWidget으로 widget test, ProviderScope.overrides로 DI mock. logic은 plain unit test.
8. **RepaintBoundary로 리빌드 격리** — DevTools 프로파일링 후 최적화. premature optimization 금지.
9. **비동기 에러 핸들링 명시적 처리** — Riverpod AsyncValue 또는 Result 패턴으로 로딩/성공/실패 상태를 항상 명시적으로 처리. UI 단에서 미처리 Exception 방지를 위해 전역 에러 바운더리 설정.
10. **Repository 레이어를 통한 데이터 추상화** — Provider에서 외부 API/DB 직접 접근 금지. Repository 인터페이스를 거쳐 데이터 접근하고, Provider는 Repository 구현체를 DI로 주입받아 사용.

### decision_table (4개)

1. **로컬 상태** → StatefulWidget 또는 flutter_hooks의 useState | avoid: ephemeral UI 상태에 Riverpod provider
2. **공유/영속 상태** → Riverpod Notifier/AsyncNotifier | avoid: StatefulWidget + callback prop drilling, InheritedWidget
3. **Data class 필요 시** → freezed `@freezed` 어노테이션 | avoid: 수동 `==`/`hashCode`/`copyWith`
4. **화면 전환/딥링크** → GoRouter 선언적 설정 | avoid: imperative Navigator.push()/pop()

---

## code-philosophy.yaml과의 중복 방지

| 주제           | code-philosophy (일반론)           | flutter.yaml (Dart 구체화)               |
| -------------- | ---------------------------------- | ---------------------------------------- |
| Immutability   | `const`, spread                    | `final` fields, `freezed/copyWith`       |
| Pure functions | "business logic as pure functions" | `*.logic.dart` 분리, build()에 로직 금지 |
| TDD            | "failing test first"               | `pumpWidget` + `ProviderScope.overrides` |

→ 보완 관계. 중복 아님.

---

## 구현 순서

### Step 1: `flutter.yaml` 생성

파일: `packages/compiler/data/rules/flutter.yaml`

### Step 2: 테스트 파일 업데이트

파일: `packages/compiler/src/schemas/__tests__/rule-data.test.ts`

- ruleFiles 배열에 `'flutter.yaml'` 추가

### Step 3: 검증

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

---

## 수정 대상 파일

| 파일                                                        | 작업                                         |
| ----------------------------------------------------------- | -------------------------------------------- |
| `packages/compiler/data/rules/flutter.yaml`                 | **새로 생성**                                |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 `'flutter.yaml'` 추가 |

## 참조 파일 (읽기 전용)

| 파일                                                | 용도                 |
| --------------------------------------------------- | -------------------- |
| `packages/compiler/src/schemas/rule.schema.ts`      | Zod 스키마 검증 대상 |
| `packages/compiler/data/rules/code-philosophy.yaml` | 중복 방지 확인       |

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 모든 기존 테스트 + flutter.yaml 스키마 검증 통과
- id/priority 유일성 테스트 통과
