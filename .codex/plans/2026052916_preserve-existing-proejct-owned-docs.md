# Preserve Project-Owned Docs And Clarify Managed Result Labels

## Summary

`ai-ops update --force`가 기존 manifest에 등록된 유효한 project-owned 문서를 보존하도록 수정한다. 추가로 `written/appended`가 “쓰기 발생 여부”가 아니라 managed section 적용 형태를 뜻한다는 주석을 남긴다.

## Key Changes

- `installProjectFiles()`에 기존 `previousProjectFiles` 보존 단계를 추가한다.
- 템플릿으로 이미 처리된 path는 그대로 두고, 이전 manifest에만 있던 path는 실제 파일이 존재하고 frontmatter가 유효하며 `owner: project`일 때만 유지한다.
- `created: false` record는 현재 파일 `contentHash`로 `templateHash`를 갱신하고, `created: true` record는 uninstall/create-only 의미를 유지하기 위해 기존 값을 보존한다.
- `ManagedInstallResult` 타입 또는 `installManagedFiles()`의 local result 선언 근처에 짧은 주석을 추가한다.

```ts
export type ManagedInstallResult = {
  // Paths where the ai-ops managed section is the standalone effective file content.
  written: string[];
  // Paths where user content remains outside the ai-ops managed section.
  appended: string[];
};
```

## Test Plan

- `project-layer.test.ts`에 “update preserves registered non-template project-owned documents” 케이스를 추가한다.
- 테스트는 `studio-launcher-architecture.md` 같은 non-template `owner: project` 문서를 이전 manifest에 등록한 뒤 `updateProjectLayer()` 실행 후 manifest, `docs-status`, context-layer에 모두 남는지 확인한다.
- 기존 project-rules discovery 테스트가 계속 통과하는지 확인한다.
- 검증 명령: `npm run test --workspace=apps/cli -- project-layer.test.ts`, 필요 시 `npm run build --workspace=apps/cli`.

## Assumptions

- `owner`는 문서 주제가 아니라 update lifecycle에서 누가 내용을 덮어쓸 수 있는지를 뜻한다.
- `studio-launcher-architecture.md`는 ai-ops-cli repo-local project-owned 문서로 유지한다.
- 삭제된 non-template project-owned 파일은 update 시 registry에서 제거해도 된다.
