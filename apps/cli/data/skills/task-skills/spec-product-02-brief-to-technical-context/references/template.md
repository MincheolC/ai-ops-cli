# 05_technical-context.md Template

```md
# 05 Technical Context

## 제품 형태
- web / app / backend / mixed

## 기본 선택 스택
- web:
  - TypeScript
  - Next.js
  - shadcn/ui
  - Tailwind CSS
  - date-fns
  - Supabase
- app:
  - Flutter
- backend:
  - NestJS
  - Prisma
  - Supabase
  - GraphQL
- simple serverless:
  - Hono
  - RESTful API

## 선택 근거
- 왜 이 조합이 현재 제품 범위에 맞는가

## 운영 / 배포 가정
- 인증
- 데이터 저장
- 배포 환경
- 서버 필요 여부

## 보안 고려사항
- auth / secret / storage / upload / 외부 callback / tenant 경계 같은 제약
- 없으면 `특이사항 없음`

## 프로젝트 제약
- 기존 코드베이스
- 팀 숙련도
- 일정 / 운영 부담

## 현재 저장소 상태 / 스택 갭
- web / app / backend surface별 현재 repo 상태: `present` / `partial` / `absent`
- 이미 재사용할 수 있는 manifest, config, app/package 디렉터리
- 부족한 scaffold, dependency install, env/config wiring
- downstream work packet에서 선행 bootstrap 패킷이 필요한 영역

## 추가 기술 제안 규칙
- 기본 선호 스택으로 해결 가능한지 먼저 검토
- 선호 밖 기술은 이유, 이점, 비용, 승인 필요 여부를 함께 기록

## 미해결 기술 결정사항
- 결정사항 1
```
