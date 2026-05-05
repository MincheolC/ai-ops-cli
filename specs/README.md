# Specs

이 디렉토리는 AI 협업 기반 spec 파이프라인을 관리합니다.

## 디렉토리 구조

```
specs/
├── baseline/   # 기준 spec 문서 (초기 요구사항, 확정된 스펙)
└── initial-build/      # 초기 구축 spec 문서
```

## 사용 방법

### baseline

프로젝트의 초기 또는 확정된 스펙 문서를 `baseline/` 디렉토리에 저장합니다.

- 파일명: `<feature-name>.md` (kebab-case)
- 내용: 요구사항, 도메인 용어, 제약 조건 등

### initial-build

초기 구축 범위와 구현 계획을 `initial-build/` 디렉토리에 저장합니다.

- 파일명: `<YYYYMMDD>-<feature-name>.md`
- 내용: 초기 구현 범위, 사용자 흐름, 데이터 모델, API 계약, 검증 기준 등
