<!-- ai-ops:start -->
<!-- sourceHash: c2028f | generatedAt: 2026-05-29T07:29:39.393Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
  - terminology_check
update_when:
  - operating_layer_changes
  - terminology_changes
---
# Agent Terminology

이 문서는 project operating layer를 해석하는 데 필요한 최소 용어만 정의한다. `ai-ops-cli`의 release, 내부 구현, phase history, integration catalog 구현 세부사항은 사용자 프로젝트의 기본 운영 문서에 포함하지 않는다.

## 핵심 용어

| 용어 | 정의 |
| --- | --- |
| agent operating layer | 프로젝트 안에서 에이전트가 읽고 따르는 운영 문서와 상태 파일의 묶음이다. |
| context layer | operating layer 문서의 경로, 상태, 읽기 조건, 갱신 조건, content hash를 추적하는 문맥 index다. |
| `docs/docs-status.md` | operating layer 문서의 status와 owner를 사람이 확인할 수 있게 기록하는 project-owned registry다. |
| `.ai-ops/context-layer.json` | 에이전트와 CLI가 문서 계층을 빠르게 탐색하고 audit할 수 있게 생성하는 index 파일이다. |
| `Active` | 현재 판단 근거로 사용할 수 있는 문서 상태다. |
| `Reserved` | 자리만 만든 문서 상태다. 프로젝트가 실제 내용을 보강하기 전까지 판단 근거로 사용하지 않는다. |
| `Draft` | 작성 중인 문서 상태다. 현재 판단 근거로 쓰기 전에 검토가 필요하다. |
| `Archived` | 과거 기록 상태다. 현재 운영 판단에 사용하지 않는다. |
| ai-ops managed | CLI 템플릿이 관리하는 문서 또는 문서 영역이다. update 시 현재 CLI 템플릿으로 다시 적용될 수 있다. |
| project-owned | 프로젝트가 직접 채우고 유지하는 문서다. CLI update는 사용자 내용을 보존해야 한다. |
| optional pack | 필요한 프로젝트에만 설치하는 추가 문서 묶음이다. 기본 operating layer와 별도의 lifecycle을 가진다. |
| `read_when` | 에이전트가 이 문서를 읽어야 하는 상황을 나타내는 frontmatter 필드다. |
| `update_when` | 문서를 갱신해야 하는 변경 상황을 나타내는 frontmatter 필드다. |

## 범위 밖

- `ai-ops-cli` release model
- `ai-ops-cli` 내부 phase history
- CLI 구현 파일이나 schema의 내부 구조
- integration catalog의 구현 세부사항

<!-- ai-ops:end -->
