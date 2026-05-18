# Portable User-Level Context Promotion Hook

## Summary

- `codex-hook install context-promotion`은 npm global 설치 환경을 전제로, repo-local `node dist/bin/index.js` 절대경로 대신 portable command를 저장한다.
- user-level `PostToolUse` hook은 모든 프로젝트에서 실행되지만, 실제 review는 `.ai-ops/context-layer.json`이 있는 repo의 성공한 `git commit` 후에만 트리거한다.
- Codex `prompt` hook은 사용하지 않고, command hook이 `decision: "block"` continuation JSON을 출력하는 방식으로 `context-promotion-review` skill 사용을 유도한다.

## Key Changes

- Hook command 기본값을 아래 형태로 바꾼다.

```json
{
  "command": "ai-ops context-promotion hook post-tool-use"
}
```

- `codex-hook install context-promotion`은 설치 시 `context-promotion-review` skill도 Codex global skill 위치에 보장 설치한다.
- 고급/비표준 PATH 환경을 위해 override 옵션을 추가한다.

```bash
ai-ops codex-hook install context-promotion --command "/custom/bin/ai-ops context-promotion hook post-tool-use"
```

- `codex-hook status context-promotion`은 hook 설치 여부와 함께 `context-promotion-review` skill 설치 여부를 표시한다.
- 기존 ai-ops legacy `PreToolUse` entry는 계속 제거한다.
- `PostToolUse` hook command는 유지한다. 실패한 commit 문자열 payload 방어와 skill 문서 분류 수정은 현재 반영된 변경을 함께 포함한다.

## Interface Changes

- 유지:
  - `ai-ops context-promotion hook post-tool-use`
  - `ai-ops codex-hook install|status|uninstall context-promotion`
- 추가:
  - `ai-ops codex-hook install context-promotion --command <command>`
- 설치 결과 기본 hook shape:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "ai-ops context-promotion hook post-tool-use",
            "timeout": 30,
            "statusMessage": "Checking context promotion review"
          }
        ]
      }
    ]
  }
}
```

## Test Plan

- Unit tests:
  - default hook command가 absolute node/bin path가 아니라 `ai-ops context-promotion hook post-tool-use`인지 확인한다.
  - `--command` override가 hooks.json에 그대로 반영되는지 확인한다.
  - install이 legacy `PreToolUse`를 제거하고 `PostToolUse`만 남기는지 확인한다.
  - status가 hook installed와 skill installed를 구분해 보고하는지 확인한다.
- E2E/smoke:
  - temp `CODEX_HOME` + temp `AI_OPS_HOME`에서 install 후 hooks.json shape와 skill 파일 존재를 확인한다.
  - 실패한 git commit 문자열은 no output, 성공 commit 문자열은 continuation JSON 출력.
  - `npm run check`, `npm run build`, `npm run compile`.

## Assumptions

- 사용자는 각 PC에서 `npm install -g ai-ops-cli` 또는 동등한 방식으로 `ai-ops` bin을 PATH에 설치한 뒤 `ai-ops codex-hook install context-promotion`을 실행한다.
- `~/.codex/hooks.json`을 PC 간 그대로 복사해 쓰는 것은 기본 지원 범위가 아니다. 그런 환경은 `--command` override로 처리한다.
- hook은 skill을 직접 실행하지 않는다. Codex가 prompt hook을 skip하므로, command hook의 `decision: "block"` continuation message로 skill 사용을 유도한다.
