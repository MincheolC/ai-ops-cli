# Rules 데이터 품질 개선 계획

## Context

컨텍스트 엔지니어링 관점에서 `packages/compiler/data/rules/` 규칙 파일들의 품질 리뷰 피드백 5건을 검증하고 수정한다.

---

## Finding 1: [High] engineering-standards 에러 스키마 불일치 — ✅ 실제 문제

**현상:**

- `constraints` → `{ code, message, requestId }` 강제
- `decision_table` → `{ code, message, details? }` (RFC 9457 기반)

**수정:**

- `constraints`의 에러 envelope을 `{ code: string, message: string, details?: unknown[] }`로 통일 (RFC 9457 기준)
- `requestId`는 이미 `guidelines`의 `meta.requestId`에서 다루고 있으므로 에러 본체에서 제거

**파일:** `packages/compiler/data/rules/engineering-standards.yaml` (constraints 5번째 항목)

---

## Finding 2: [High] graphql 에러 모델 혼재 — ⚠️ 부분적 문제

**현상:**

- `constraints` → union 기반 에러 타입 권장
- `guidelines` → `userErrors` payload 패턴 권장
- `decision_table` → 둘 다 언급

**판단:** union과 userErrors는 대립이 아니라 **보완 관계**. union은 타입 수준 분기, userErrors는 payload 필드. 다만 현재 서술이 이 관계를 명확히 하지 않아 혼란 가능.

**수정:**

- `decision_table`의 mutation failure 항목에서 union + userErrors가 함께 쓰이는 패턴임을 명시
- constraints의 union 설명에 "mutation Payload의 반환 타입으로" 스코프 한정

**파일:** `packages/compiler/data/rules/graphql.yaml`

---

## Finding 3: [Medium] 테스트 정적 목록 누락 + priority 충돌 — ✅ 실제 문제

**현상:**

- `rule-data.test.ts`의 `ruleFiles` 배열에 `plan-mode.yaml` 누락
- `engineering-standards`(70)와 `plan-mode`(70) priority 충돌
- 테스트가 정적 목록이라 새 파일 추가 시 자동 감지 불가

**수정:**

1. `plan-mode.yaml`을 `ruleFiles` 배열에 추가
2. `plan-mode.yaml`의 priority를 71로 변경 (충돌 해소)
3. `ruleFiles`를 정적 배열 대신 `fs.readdirSync`로 `*.yaml` 자동 수집하도록 변경

**파일:**

- `packages/compiler/src/schemas/__tests__/rule-data.test.ts`
- `packages/compiler/data/rules/plan-mode.yaml`

---

## Finding 4: [Medium] plan-mode의 "항상 Mermaid" 글로벌 강제 과도 — ✅ 동의

**현상:**

- `plan-mode.yaml`은 `category: standard` → 항상 글로벌 로딩
- "DO NOT use plain bullet lists" 같은 규칙이 모든 컨텍스트에 주입됨

**수정:**

- `plan-mode.yaml`의 category를 `standard` → `convention`으로 변경... 하려 했으나 `convention`도 글로벌임
- 대안: category를 `planning`(새 비글로벌 카테고리)으로 변경하고, presets.yaml에서 필요한 preset에만 포함
- 또는 더 간단하게: constraints를 guidelines로 완화 ("MUST" → "prefer")

**권장:** constraints 톤을 완화. "항상 Mermaid"는 guidelines로 이동하고, constraints에는 plan-mode 고유 불변식만 남김.

**파일:** `packages/compiler/data/rules/plan-mode.yaml`

---

## Finding 5: [Medium] 도구/취향 강제 규칙 과다 — 📋 장기 과제

**현상:**

- `interface 전면 금지`, `Any 전면 금지`, 특정 라이브러리 단일 강제 등
- 모델이 이미 아는 일반론 반복 → 토큰 비용 증가

**판단:** 이건 이 프로젝트의 핵심 가치 제안(opinionated scaffolding)이므로 현 시점에서 제거는 부적절. 다만 향후 린터/포매터로 강제 가능한 항목은 분리 검토 대상.

**수정:** 이번 스코프에서는 변경 없음. 향후 과제로 기록.

---

## 수정 대상 파일 요약

| 파일                               | 변경 내용                            |
| ---------------------------------- | ------------------------------------ |
| `rules/engineering-standards.yaml` | 에러 envelope 스키마 통일            |
| `rules/graphql.yaml`               | union + userErrors 관계 명확화       |
| `rules/plan-mode.yaml`             | priority 71로 변경, constraints 완화 |
| `rule-data.test.ts`                | plan-mode 추가, 정적→동적 파일 수집  |

---

## Verification

```bash
cd packages/compiler && npm test
```

- rule-data.test.ts의 priority 유일성 테스트 통과 확인
- 모든 YAML의 RuleSchema 파싱 통과 확인
- `npm run build` 정상 완료 확인
