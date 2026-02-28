# Rule 품질 리뷰 프롬프트

`packages/compiler/data/rules/` 아래 YAML 파일들을 추가하거나 수정한 뒤,
아래 프롬프트를 AI에게 전달해 품질을 검증한다.

---

## 사용법

1. 검토할 rule YAML 파일(들)을 첨부하거나 내용을 붙여넣는다.
2. 기존 규칙을 **수정/압축**한 경우, 수정 전 원본(또는 `git diff`)도 함께 첨부한다.
3. 아래 프롬프트 전체를 함께 전달한다.
4. 출력된 리뷰 결과를 보고 지적 사항을 수정한다.

---

## 프롬프트

```
아래 rule YAML 파일(들)을 컨텍스트 엔지니어링 관점에서 리뷰해줘.
이 파일들은 AI 에이전트의 시스템 프롬프트로 주입되는 규칙 데이터야.

다음 5가지 기준으로 판단해. 각 항목에서 문제가 없으면 "✅ 이상 없음"으로 표기해.
(기준 5는 기존 규칙을 수정/압축한 경우에만 적용. 신규 작성이면 생략.)

---

### 기준 1: 규칙 간 모순 (Contradiction)

이 파일 + 기존 rule 파일들 사이에서:
- 같은 상황에 대해 서로 다른 행동을 지시하는 규칙이 있는가?
- 한 파일의 constraint가 다른 파일의 guideline과 충돌하는가?
- decision_table의 then/avoid가 다른 파일의 then/avoid와 대립하는가?

모순이 발견되면: 파일A의 어떤 규칙 vs 파일B의 어떤 규칙이 충돌하는지 구체적으로 적어줘.

---

### 기준 2: 프로젝트 고유 정보만 포함되어 있는가 (Signal vs. Noise)

AI 모델이 이미 잘 알고 있는 일반론은 토큰 낭비다. 다음 질문으로 판단해:

"이 규칙이 없어도 현대적인 AI 코딩 어시스턴트가 알아서 할 수 있는가?"
→ Yes라면 제거 또는 축소 후보

규칙이 유지되어야 하는 정당한 이유:
- 이 조직/프로젝트만의 비표준 선택 (예: 특정 라이브러리 강제, 비통상적 폴더 구조)
- 표준과 반대로 가는 의도적 결정 (예: 보통은 X를 쓰지만 여기선 Y를 써야 하는 이유)
- 틀렸을 때 조용히 실패하는 위험한 패턴 (silent failure, data corruption 등)

각 constraint/guideline 항목에 대해 "모델이 이미 아는 일반론"으로 의심되는 항목을 열거해줘.

---

### 기준 3: constraints는 진짜 불변식인가 (Constraint Inflation)

constraints는 "위반 시 객관적인 피해(버그, 보안, 데이터 손상)가 발생하는 규칙"이어야 한다.
"스타일 선호", "더 좋은 방식", "권장 패턴"은 guidelines에 속한다.

각 constraints 항목에 대해:
- 위반 시 어떤 구체적 피해가 발생하는가를 확인한다.
- 피해가 모호하거나 "그냥 안 좋아서"라면 guideline으로 이동을 제안한다.

---

### 기준 4: 위험 작업 규칙의 완결성 (Dangerous Operation Coverage)

파일이 다루는 도메인에서 "틀렸을 때 되돌리기 어려운 작업"이 있는가?
(예: DB 마이그레이션, 외부 API 호출, 파일 삭제, 배포, 스키마 변경 등)

해당 작업에 대한 규칙이 있다면:
- 사전 조건(pre-condition) 확인 규칙이 있는가?
- 실패 시 복구 절차 또는 롤백 기준이 명시되어 있는가?

없다면 추가가 필요한 항목을 제안해줘.

---

### 기준 5: 수정 시 의미 보존 (Semantic Fidelity)

> 기존 규칙을 수정(압축, 리팩터링 등)한 경우에만 적용한다. 신규 작성이면 이 기준은 건너뛴다.

수정 전 원본과 비교하여 다음 5가지 실패 패턴이 있는지 검사해:

1. **한정어 삽입 (Qualifier Injection)**
   원본이 절대 금지인데 수정본에 "unless", "by default", "when possible" 등이 추가되어 escape hatch가 생겼는가?
   예: `DO NOT use Any` → `DO NOT use Any unless there is no viable alternative`

2. **범위 축소 (Scope Narrowing)**
   수정본에 "shared", "in core logic", "on large data" 같은 범위 한정어가 추가되어 원본보다 적용 범위가 좁아졌는가?
   예: `DO NOT mutate state` → `DO NOT mutate shared state in business logic`

3. **구체 정보 소실 (Actionable Specifics Lost)**
   LLM의 판단에 실제로 필요한 구체적 API명, 메서드명, 패턴 선택 기준 등이 빠졌는가?
   예: `selectinload() for 1:N, joinedload() for N:1` → `choose eager loading intentionally`

4. **예외 조건 삭제 (Exception Erasure)**
   원본에 문서화된 허용 예외가 삭제되어 false positive 위반이 발생할 수 있는가?
   예: JWT exp/iat에서 Unix epoch 허용 예외가 삭제됨

5. **패턴 관계 소실 (Pattern Nuance Collapse)**
   두 패턴 간의 관계(상호보완, 대안, 순서 등)가 압축 과정에서 하나로 합쳐져 의미가 바뀌었는가?
   예: `Payload AND Union are complementary` → `return typed errors in payload`

---

### 출력 형식

각 기준마다 다음 형식으로 답해줘:

**[기준 N: 제목]**
- 심각도: High / Medium / Low / ✅ 이상 없음
- 발견 사항: (구체적 항목 나열. 없으면 생략)
- 제안: (수정 방향. 없으면 생략)

마지막에 "수정이 필요한 항목" 요약 테이블을 붙여줘:
| 파일 | 항목 | 기준 | 심각도 |
```
