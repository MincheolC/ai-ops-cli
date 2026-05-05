# 파일 내부 구조화 규칙 추가

## Context

AI가 생성한 코드에서 types, constants, validators 등이 평평하게 나열되어 "어디서 어디까지가 한 덩어리인지" 파악이 어려운 문제.
파일 분리 전 단계에서 **선언 순서 컨벤션 + 섹션 구분 주석**으로 시각적 구조를 부여하는 규칙을 추가한다.

## 변경 대상

- `apps/cli/data/rules/code-philosophy.yaml` (YAML 소스)
- `.claude/rules/code-philosophy.md` (빌드로 자동 생성 — 직접 수정 안 함)

## 변경 내용

### guidelines 추가 (2항목)

```yaml
- 'Within a file, order declarations by role: types → constants → validators/guards → helper functions → main logic/exports.'
- 'When a file contains multiple semantic groups, add section divider comments (e.g., // ----- types -----) between groups.'
```

### decision_table 추가 (1항목)

```yaml
- when: 'A file has two or more distinct semantic groups (types, constants, logic, etc.)'
  then: 'Order declarations by role and add section divider comments between groups'
  avoid: 'Flat interleaving of unrelated declarations without visual separation'
```

## 리뷰 기준 (`docs/rule-review-prompt.md`) 사전 검증

| 기준                    | 판정         | 근거                                                                                                        |
| ----------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| 1. 규칙 간 모순         | ✅           | 기존 규칙과 충돌 없음                                                                                       |
| 2. Signal vs Noise      | ⚠️ 검토 필요 | 선언 순서는 일반론에 가까울 수 있음. 단, 프로젝트에서 AI 생성 코드의 일관성을 강제하는 목적이므로 유지 정당 |
| 3. Constraint Inflation | ✅           | guidelines로 추가 (constraint 아님)                                                                         |
| 4. 위험 작업 완결성     | ✅           | 해당 없음 (코드 스타일 규칙)                                                                                |
| 5. 의미 보존            | N/A          | 기존 규칙 수정 아닌 신규 추가                                                                               |

> **기준 2 보충**: "선언 순서"와 "섹션 주석" 모두 AI가 자율적으로 일관되게 적용하기 어려운 영역. 특히 섹션 주석은 명시하지 않으면 거의 생성하지 않으므로 규칙으로 남길 가치가 있음.

## 검증 방법

```bash
npm run build        # YAML → MD 생성 확인
npm test             # 기존 테스트 통과 확인
```

빌드 후 `.claude/rules/code-philosophy.md`에 추가 항목이 반영되었는지 확인.
