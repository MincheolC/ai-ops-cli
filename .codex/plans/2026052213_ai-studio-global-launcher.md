# `ai-ops studio .` Global CLI Launcher

## Summary

`npm install -g ai-ops-cli`만으로 `ai-ops studio .`가 현재 프로젝트의 ai-ops Studio 데스크톱 앱을 실행하게 만든다. v1은 `macOS arm64`만 지원하고, Studio native binary는 별도 optional platform package인 `ai-ops-studio-darwin-arm64`로 배포한다.

## Key Changes

- CLI public surface:
  - `ai-ops studio [project]`: Studio desktop app 실행. 기본값은 `.`.
  - `ai-ops studio snapshot --json`: 기존 snapshot JSON helper 유지.
- `ai-ops-cli` package:
  - `optionalDependencies`에 `ai-ops-studio-darwin-arm64` 추가.
  - `process.platform/process.arch`가 `darwin/arm64`이면 platform package의 `bin/ai-ops-studio`를 resolve해서 실행.
  - 실행 시 `AI_OPS_STUDIO_PROJECT_ROOT=<resolved project path>`와 `AI_OPS_CLI_BIN=<current cli bin>`을 env로 전달.
  - unsupported platform, missing optional package, invalid project path는 명확한 stderr + non-zero exit로 처리.
- Studio platform package:
  - 새 workspace package `ai-ops-studio-darwin-arm64` 추가.
  - `os: ["darwin"]`, `cpu: ["arm64"]`, `files: ["bin"]`.
  - `bin/ai-ops-studio`에는 `apps/studio/src-tauri/target/release/ai-ops-studio` 산출물을 복사해 publish.
- Build/release:
  - root script에 Studio release binary/package 준비 명령 추가.
  - release flow는 platform package를 먼저 publish하고, 그 다음 `ai-ops-cli`를 publish한다.
  - 기존 `npm run studio:dev`는 source checkout 개발용으로 유지한다.

## Implementation Notes

- 중단 직전에 들어간 `apps/cli/src/features/studio/register.ts`의 launcher 초안은 이 계획에 맞춰 완성한다. `--app-dir` 방식은 제거하고, 글로벌 실행 기준인 platform binary resolver로 바꾼다.
- Tauri shell의 기존 `AI_OPS_STUDIO_PROJECT_ROOT` / `AI_OPS_CLI_BIN` 계약은 유지한다.
- `apps/studio/README*`의 "`ai-ops studio` launcher command is non-goal" 문구는 제거하고, 글로벌 실행 경로와 source checkout 개발 경로를 분리해 문서화한다.
- `CHANGELOG.md`의 `Unreleased`에 global Studio launcher와 macOS arm64 package 추가를 기록한다.

## Test Plan

- Unit tests:
  - `ai-ops studio .`가 project path를 absolute path로 resolve한다.
  - `darwin/arm64`에서 platform package binary를 찾고 spawn env에 `AI_OPS_STUDIO_PROJECT_ROOT`와 `AI_OPS_CLI_BIN`을 넣는다.
  - missing optional package와 unsupported platform이 actionable error를 낸다.
  - `ai-ops studio snapshot --json` 기존 동작이 깨지지 않는다.
- Package tests:
  - `apps/cli/package.json` optional dependency 계약 확인.
  - `ai-ops-studio-darwin-arm64` package metadata의 `os/cpu/files` 확인.
  - `npm pack --dry-run --workspace=apps/cli`와 platform package dry-run으로 포함 파일 확인.
- Validation:
  - `npm test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - Studio release binary build on macOS arm64
  - local global-style smoke: built CLI로 `ai-ops studio .` 실행 후 데스크톱 창이 열리고 snapshot을 읽는지 확인.

## Assumptions

- v1 지원 플랫폼은 macOS arm64만이다.
- npm package 이름은 현재 unscoped package convention에 맞춰 `ai-ops-studio-darwin-arm64`를 사용한다.
- `ai-ops studio .`는 기본적으로 데스크톱 앱을 띄우는 launcher이고, machine-readable JSON은 계속 `ai-ops studio snapshot --json`만 담당한다.
