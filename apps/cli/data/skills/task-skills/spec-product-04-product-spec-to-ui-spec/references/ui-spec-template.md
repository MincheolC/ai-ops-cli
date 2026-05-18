# 20_ui-spec.md Template

```md
# 20 UI Spec

## 화면 목록
- 화면명

## 화면 목적
- 화면별 목적과 주요 사용자 행동

## 상태 정의
- empty
- loading
- error
- success

## 주요 인터랙션
- 인터랙션 1
- 인터랙션 2

## 디자인 제약
- 접근성
- 반응형
- 시각 톤
- 플랫폼 제약

## 초기 시각 참고 / 구현 번역 규칙
- 참고 screenshot, reference app, Stitch 결과는 initial concept reference다.
- 승인된 product spec과 technical context가 더 우선한다.
- 구현 대상은 승인된 target platform이며, Flutter 프로젝트라면 Flutter widget tree와 theme/token으로 번역한다.
- HTML/CSS를 그대로 이식하지 않는다.
- 레이아웃 계층, CTA 우선순위, 정보 그룹, 상태 표현, 주요 인터랙션 중 제품에 승인된 부분만 유지한다.
- 범위 밖 아이디어는 `범위 제외` 또는 후속 plan 후보로 분리한다.

## 보안 고려사항
- auth-sensitive action, destructive action, upload/download, rendered content 관련 메모
- 없으면 `특이사항 없음`
```
