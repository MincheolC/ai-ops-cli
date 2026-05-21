---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
update_when:
  - baseline_rule_changes
---

# Agent Baseline Rules

이 문서는 모든 작업 전에 먼저 적용할 기본 협업 규칙이다. 세부 routing, workflow, stop rule보다 앞서 읽고, 프로젝트별 Active 문서가 더 구체적인 판단 근거를 제공하면 그 문서를 우선한다.

## 협업 태도

- 사용자를 초보자로 낮춰 설명하지 않는다.
- 사용자는 senior developer라고 가정하되, 특정 도메인이나 패턴에 익숙하지 않을 수 있음을 고려한다.
- 패턴, 라이브러리, 아키텍처를 고를 때는 중요한 선택 이유를 짧게 설명한다.
- 아키텍처, edge case, 성능, 유지보수성을 우선해 판단한다.

## 커뮤니케이션

- "Certainly", "Of course", "Here is the code", "I understand", "Great question" 같은 filler phrase로 시작하지 않는다.
- 사용자가 명시적으로 영어를 요청하지 않는 한, 코드와 inline code comment를 제외한 응답은 한국어로 작성한다.
- 불확실한 내용은 단정하지 않고 확인 가능한 근거, 추론, 남은 리스크를 구분한다.

## 코드 철학

- clever하거나 opaque한 코드보다 의도가 드러나는 명시적인 코드를 우선한다.
- Rule of Three 이전에는 공통 abstraction을 서두르지 않는다.
- core business logic에는 side effect를 섞지 않고, functional core / imperative shell 구조를 선호한다.
- 상태 변경은 가능한 한 immutable update로 처리한다.
- 복잡한 business rule은 실패하는 테스트를 먼저 두고 구현한다.
- 파일 내부 선언은 types, constants, validators/guards, helper functions, main logic/exports 순서로 배치한다.
- 한 파일에 의미가 다른 그룹이 둘 이상 있으면 `// ----- types -----` 같은 section divider comment로 경계를 표시한다.

## 유지보수/리팩토링 기준

- 줄 수 기준은 hard gate가 아니라 검토 신호로 사용한다. 자동 lint/test 실패 조건을 만들기보다 변경 맥락에서 분리 필요성을 판단한다.
- touched production file이 250줄을 넘으면 책임 경계, 테스트 위치, helper 추출 가능성을 한 번 확인한다.
- 새 기능을 400줄 이상 파일에 추가하려면 먼저 feature slice, command shell, pure logic, schema/state I/O로 나눌 수 있는지 검토한다.
- production TypeScript 파일이 600줄을 넘으면 다음 기능 추가 전에 분리 계획을 우선 세운다.
- 같은 패턴이 세 번째 등장하면 WET 유지보다 shared helper 또는 feature-local abstraction이 더 명확한지 확인한다.
- 한 변경이 서로 다른 책임의 section 3곳 이상을 건드리면 파일/폴더 경계를 다시 그릴 시점으로 본다.
- 공통화는 Rule of Three와 호출 맥락이 함께 맞을 때 진행한다. 우발적으로 비슷한 코드 두 개만 보고 abstraction을 만들지 않는다.
- 리팩토링은 public CLI command, option, JSON/schema 계약을 보존하는 작은 이동부터 시작하고, behavior assertion은 먼저 유지한다.

## 네이밍

- directory name은 kebab-case를 사용한다.
- 새 파일과 문서 이름은 역할이 드러나는 구체적인 이름을 사용한다.

## 계획과 다이어그램

- flow, sequence, state, structure를 설명할 때 긴 bullet list보다 Mermaid diagram을 우선 검토한다.
- UX/control flow와 decision tree는 `flowchart`, request/response와 service interaction은 `sequenceDiagram`, entity/schema relationship은 `erDiagram`, lifecycle/state transition은 `stateDiagram-v2`를 사용한다.
- Mermaid diagram은 fenced `mermaid` code block으로 작성한다.
- plan 문서를 저장할 때는 `YYYYMMDDHH_<topic>.md` 형식을 사용하고, topic은 kebab-case로 작성한다.
