# docs/business/terminology.md Template

```md
---
status: Active
layer: business
owner: project
read_when:
  - terminology_check
  - business_rule_check
  - spec_lifecycle
update_when:
  - terminology_changes
  - business_rule_changes
  - spec_lifecycle_changes
---
# Terminology

용어 표기 원칙:

- `용어` 칼럼은 한국어 우선이지만, 업계 표준 영어가 더 명확하면 영어 원형을 그대로 쓴다.
- `소스 오브 트루스` 같은 어색한 음역 대신 `source of truth` 또는 한국어 설명형 표현을 사용한다.

## 핵심 용어

| 용어 | 영문 / 코드명 | 정의 | 사용 범위 | 허용 별칭 | 금지 표현 | 관련 문서 |
|---|---|---|---|---|---|---|
| 용어 1 | `termName` | 짧은 정의 | brief / spec / ui | 별칭 1 | 금지 표현 1 | `10_product-spec.md` |

## 엔티티 용어

| 용어 | 영문 / 코드명 | 정의 | 사용 범위 | 허용 별칭 | 금지 표현 | 관련 문서 |
|---|---|---|---|---|---|---|
| 엔티티 1 | `entityName` | 짧은 정의 | spec / packet | 별칭 1 | 금지 표현 1 | `10_product-spec.md` |

## 상태 용어

| 용어 | 영문 / 코드명 | 정의 | 사용 범위 | 허용 별칭 | 금지 표현 | 관련 문서 |
|---|---|---|---|---|---|---|
| 상태 1 | `draft` | 짧은 정의 | spec / ui / packet | 별칭 1 | 금지 표현 1 | `10_product-spec.md` |

## UI 용어

| 용어 | 영문 / 코드명 | 정의 | 사용 범위 | 허용 별칭 | 금지 표현 | 관련 문서 |
|---|---|---|---|---|---|---|
| UI 용어 1 | `labelName` | 짧은 정의 | ui / packet | 별칭 1 | 금지 표현 1 | `20_ui-spec.md` |

## 금지하거나 피할 표현

| 표현 | 이유 | 대신 사용할 표현 |
|---|---|---|
| 표현 1 | 왜 피해야 하는지 | 표준 표현 |

## 검토 중인 용어

| 항목 | 후보 표현 | 충돌 / 불확실성 | 판단 메모 | 관련 문서 |
|---|---|---|---|---|
| 충돌 항목 | 새로 발견된 표현 | 현재 표준 표현과의 차이 | 판단 메모 | `10_product-spec.md` |
```
