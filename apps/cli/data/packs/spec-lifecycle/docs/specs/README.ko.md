---
status: Reserved
layer: spec
owner: project
read_when:
  - spec_lifecycle
update_when:
  - spec_lifecycle_changes
---
# Specs

[English](./README.md)

이 문서는 Reserved 상태입니다. 프로젝트가 실제 spec lifecycle 문서를 보강하기 전까지 현재 판단 근거로 사용하지 마세요.

## 디렉토리 구조

```text
docs/specs/
├── baseline/
└── initial-build/
```

## 기준

- `baseline/`은 승인된 제품/기술/UI 기준 문서를 둡니다.
- `initial-build/`는 초기 구현 work packet과 관련 산출물을 둡니다.
- 프로젝트 용어는 `docs/business/terminology.md`를 기준으로 관리합니다. 이 optional spec pack은 별도 용어 source of truth를 만들지 않습니다.
- 실제 판단 근거로 쓰기 전에 각 문서의 frontmatter와 `docs/docs-status.md` 상태를 갱신합니다.
