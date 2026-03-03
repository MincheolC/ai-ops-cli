# Rule 파일 작성 & 검증 가이드

Rule YAML을 추가하거나 수정할 때 사용하는 체크리스트 + 품질 기준 문서.

---

## 1. 스키마 구조 (필수 필드)

```yaml
id: kebab-case-only # 파일명과 일치. /^[a-z0-9]+(-[a-z0-9]+)*$/ 강제
category: standard # 카테고리 문자열 (free-form, 비어있으면 안됨)
tags:
  - general
priority: 50 # 0~100 정수. 전체에서 유일해야 함
content:
  constraints: # 필수. "하지 마라" 금지 패턴. 빈 배열 []도 허용
    - 'DO NOT ...'
  guidelines: # 필수. "해라" 권장 패턴.
    - '...'
  decision_table: # 선택. when/then/avoid 구조
    - when: '...'
      then: '...'
      avoid: '...' # avoid는 optional
```

> **참고 파일:** `apps/cli/src/core/schemas/rule.schema.ts`

---

## 2. Priority 배정 규칙

Priority는 **0~100 정수이며 전체 rule 파일 간 유일**해야 한다.
`rule-data.test.ts`의 `모든 rule의 priority가 유일하다` 테스트가 중복을 검출한다.

**현재 배정된 priority 목록** (새 rule 추가 시 충돌 확인):

| priority | id                    |
| -------- | --------------------- |
| 90       | role-persona          |
| 85       | communication         |
| 80       | code-philosophy       |
| 75       | naming-convention     |
| 71       | plan-mode             |
| 70       | engineering-standards |
| 65       | typescript            |
| 60       | react-typescript      |
| 55       | python                |
| 50       | nextjs                |
| 48       | graphql               |
| 45       | nestjs                |
| 43       | nestjs-graphql        |
| 42       | fastapi               |
| 40       | prisma-postgresql     |
| 38       | sqlalchemy            |
| 35       | shadcn-ui             |
| 33       | data-pipeline-python  |
| 30       | flutter               |
| 28       | ai-llm-python         |
| 25       | libs-backend-ts       |
| 22       | libs-backend-python   |
| 20       | libs-frontend-web     |
| 15       | libs-frontend-app     |

> 이 표는 rule 추가/삭제 시 직접 업데이트한다.

---

## 3. Constraints vs Guidelines 구분 기준

| 기준         | constraints                                          | guidelines                          |
| ------------ | ---------------------------------------------------- | ----------------------------------- |
| 문장 형식    | `DO NOT ...` (금지)                                  | 긍정 서술 ("Use ...", "Prefer ...") |
| 위반 시 영향 | 버그, 보안 취약점, 스키마 불일치 등 객관적 피해 발생 | 품질·일관성 저하 (주관적)           |
| AI 모델 수신 | 컨텍스트 상단에 배치 → 제동력 강함                   | constraints 이후 배치               |
| 예시         | `DO NOT use auto-increment IDs`                      | `Prefer cursor-based pagination`    |

**판단 기준:** "이 규칙을 어기면 시스템이 망가지는가?" → Yes면 constraint, No면 guideline.

---

## 4. 주요 표준 & 패턴 (기존 rule과 일관성 유지)

### 에러 응답 envelope (RFC 9457)

```yaml
# engineering-standards.yaml 기준
{ code: string, message: string, details?: unknown[] }
```

- `requestId`는 **에러 본체가 아닌 응답 meta**에 포함: `{ data, error, meta: { requestId, timestamp } }`
- 임의 shape (`{ success: false, msg }`) 금지

### GraphQL 에러 패턴

union 타입과 `userErrors`는 **대립이 아닌 보완 관계**:

- `union UserError = ValidationError | EmailTakenError` → `__typename` 기반 분기
- `type Payload { user: User, userErrors: [UserError!]! }` → uniform iterable

새 rule에서 이 중 하나만 언급하면 오해를 유발한다. 둘의 관계를 명시할 것.

---

## 5. 파일 추가 체크리스트

새 rule YAML을 `apps/cli/data/rules/`에 추가할 때:

```
□ id가 파일명과 일치하고 kebab-case인가
□ priority가 위 표에 없는 값인가 (충돌 없음 확인)
□ constraints 항목이 "DO NOT"으로 시작하는가
□ guidelines 항목이 긍정 서술인가
□ constraints에 실제 "불변식(invariant)" 수준의 규칙만 있는가
  (스타일 선호 → guidelines로 이동)
□ decision_table의 then이 구체적 행동을 담고 있는가
  (avoid는 선택이지만 있으면 then보다 구체적이어야 함)
□ 기존 rule과 내용이 중복되지 않는가 (engineering-standards와 특히 겹치기 쉬움)
```

---

## 6. 검증 명령어

```bash
# rule-data.test.ts: 스키마 파싱 + id 유일성 + priority 유일성 자동 검사
npm run test --workspace=apps/cli

# 빌드 검증
npm run build
```

`rule-data.test.ts`는 `readdirSync`로 `data/rules/*.yaml`을 **자동 수집**한다.
새 파일 추가 시 테스트 파일을 수정할 필요 없다.

---

## 7. 흔한 실수 (과거 이슈에서 발췌)

| 실수                                           | 올바른 처리                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| priority 중복                                  | 위 표 먼저 확인 후 빈 값 배정                                         |
| 에러 envelope에 `requestId` 포함               | `details?: unknown[]`로 통일, requestId는 meta로                      |
| "항상 X를 써라" 류를 constraint에 넣음         | 스타일 강제는 guideline. constraint는 위반 시 객관적 피해가 있을 때만 |
| GraphQL union과 userErrors를 양자택일처럼 기술 | 두 패턴의 보완 관계를 명시                                            |
| 테스트 ruleFiles 배열에 새 파일 수동 추가      | 불필요. readdirSync 자동 수집                                         |
