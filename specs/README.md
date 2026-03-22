# Specs

이 디렉토리는 AI 협업 기반 spec 파이프라인을 관리합니다.

## 디렉토리 구조

```
specs/
├── baseline/   # 기준 spec 문서 (초기 요구사항, 확정된 스펙)
└── delta/      # 변경 spec 문서 (기준 대비 추가/수정 사항)
```

## 사용 방법

### baseline

프로젝트의 초기 또는 확정된 스펙 문서를 `baseline/` 디렉토리에 저장합니다.

- 파일명: `<feature-name>.md` (kebab-case)
- 내용: 요구사항, 도메인 용어, 제약 조건 등

### delta

기준 스펙 대비 변경되는 내용을 `delta/` 디렉토리에 저장합니다.

- 파일명: `<YYYYMMDD>-<feature-name>.md`
- 내용: 변경 이유, 변경 전/후 비교, 영향 범위 등
