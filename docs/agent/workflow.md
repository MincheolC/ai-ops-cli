<!-- ai-ops:start -->
<!-- sourceHash: 3f6980 | generatedAt: 2026-05-16T11:06:18.637Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
update_when:
  - workflow_changes
---
# Workflow

## 기본 흐름

1. 요청 범위와 현재 작업 디렉터리를 확인한다.
2. 관련 문서의 `status`를 확인하고 `Active` 문서만 판단 근거로 사용한다.
3. 코드 변경 전 현재 diff를 확인한다.
4. 변경은 가능한 작은 단위로 적용한다.
5. 변경 범위에 맞는 검증을 실행한다.
6. 결과, 검증, 남은 리스크를 짧게 보고한다.

## 보존 원칙

- 사용자 변경으로 보이는 diff는 되돌리지 않는다.
- project-owned 문서는 CLI update가 덮어쓰지 않는다.
- global skills와 subagents는 project operating layer uninstall 대상이 아니다.

<!-- ai-ops:end -->
