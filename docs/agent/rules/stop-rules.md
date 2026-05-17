<!-- ai-ops:start -->
<!-- sourceHash: 3f6980 | generatedAt: 2026-05-16T11:06:18.637Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_destructive_action
  - before_external_side_effect
update_when:
  - safety_policy_changes
---
# Stop Rules

## 멈추고 확인할 때

- 삭제, reset, 강제 overwrite처럼 복구가 어려운 작업이 필요한 경우
- credential, 개인 정보, 운영 데이터가 노출될 수 있는 경우
- 계획 문서와 실제 코드 구조가 충돌해 임의 판단이 위험한 경우
- 검증 실패 원인이 환경 문제인지 구현 문제인지 구분되지 않는 경우

확인이 필요한 지점은 짧게 설명하고, 안전한 대안이 있으면 함께 제시한다.

<!-- ai-ops:end -->
