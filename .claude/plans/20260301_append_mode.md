# Non-managed 파일에 Append 모드 추가

## Context

현재 `installFiles`는 기존 파일이 `<!-- managed by ai-ops -->` 마커 없으면 skip 처리한다.
사용자가 이미 AGENTS.md, GEMINI.md 등을 직접 만들어 둔 경우, ai-ops 룰이 아예 설치되지 않는 문제가 있다.

**목표**: non-managed 파일이 존재하면, 기존 내용을 보존하면서 ai-ops 생성 콘텐츠를 append한다.
섹션 마커(`<!-- ai-ops:start -->` / `<!-- ai-ops:end -->`)로 감싸서, uninstall/update 시 해당 섹션만 제거/교체할 수 있게 한다.

---

## 1. 섹션 마커 유틸 추가

**파일**: `packages/compiler/src/managed-header.ts`

```typescript
const SECTION_START = '<!-- ai-ops:start -->';
const SECTION_END = '<!-- ai-ops:end -->';

// 섹션 마커로 콘텐츠 감싸기 (append용)
export const wrapWithSection = (content: string, meta: { sourceHash: string; generatedAt: string }): string => {
  const metaLine = `<!-- sourceHash: ${meta.sourceHash} | generatedAt: ${meta.generatedAt} -->`;
  return `${SECTION_START}\n${metaLine}\n\n${content}\n${SECTION_END}`;
};

// 파일에 ai-ops 섹션이 있는지 확인
export const hasAiOpsSection = (content: string): boolean =>
  content.includes(SECTION_START) && content.includes(SECTION_END);

// ai-ops 섹션만 제거 (uninstall용)
export const stripAiOpsSection = (content: string): string => {
  const startIdx = content.indexOf(SECTION_START);
  const endIdx = content.indexOf(SECTION_END);
  if (startIdx === -1 || endIdx === -1) return content;

  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + SECTION_END.length).trimStart();
  return before + (after ? '\n\n' + after : '') + '\n';
};

// ai-ops 섹션 교체 (update용)
export const replaceAiOpsSection = (existing: string, newSection: string): string => {
  const startIdx = existing.indexOf(SECTION_START);
  const endIdx = existing.indexOf(SECTION_END);
  if (startIdx === -1 || endIdx === -1) return existing;

  const before = existing.slice(0, startIdx).trimEnd();
  const after = existing.slice(endIdx + SECTION_END.length).trimStart();
  return before + '\n\n' + newSection + (after ? '\n\n' + after : '') + '\n';
};
```

export는 `packages/compiler/src/index.ts`에서 re-export.

---

## 2. `installFiles` 수정 — append 동작 추가

**파일**: `apps/cli/src/lib/install.ts`

`InstallResult`에 `appended: string[]` 필드 추가.

```typescript
export type InstallResult = {
  written: string[];
  appended: string[]; // 기존 non-managed 파일에 섹션 추가됨
  skipped: string[]; // 이 경우는 더 이상 발생하지 않거나, 다른 이유로만 발생
};
```

핵심 로직 변경:

```typescript
if (existsSync(absPath)) {
  const existing = readFileSync(absPath, 'utf-8');
  if (isManagedFile(existing)) {
    // 기존: managed → 덮어쓰기 (변경 없음)
    writeFileSync(absPath, action.content, 'utf-8');
    written.push(action.relativePath);
  } else if (hasAiOpsSection(existing)) {
    // 이전에 append된 파일 → 섹션만 교체
    const sectionContent = wrapWithSection(stripManagedHeader(action.content), meta);
    const updated = replaceAiOpsSection(existing, sectionContent);
    writeFileSync(absPath, updated, 'utf-8');
    appended.push(action.relativePath);
  } else {
    // non-managed, 섹션 없음 → 최초 append
    const sectionContent = wrapWithSection(stripManagedHeader(action.content), meta);
    const updated = existing.trimEnd() + '\n\n' + sectionContent + '\n';
    writeFileSync(absPath, updated, 'utf-8');
    appended.push(action.relativePath);
  }
} else {
  // 새 파일 → 기존대로 managed header 포함 작성
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, action.content, 'utf-8');
  written.push(action.relativePath);
}
```

`installFiles`에 `meta` 파라미터 추가 필요 (섹션 마커에 sourceHash/generatedAt 포함 위해).

---

## 3. `removeFiles` 수정 — append된 파일은 섹션만 제거

**파일**: `apps/cli/src/lib/uninstall.ts`

`UninstallResult`에 `cleaned: string[]` 추가 (섹션만 제거된 파일).

```typescript
if (!isManagedFile(content)) {
  if (hasAiOpsSection(content)) {
    // append된 파일 → 섹션만 제거, 사용자 콘텐츠 보존
    const cleaned = stripAiOpsSection(content);
    writeFileSync(absPath, cleaned, 'utf-8');
    result.cleaned.push(rel);
  } else {
    skipped.push(rel);
  }
  continue;
}
```

---

## 4. Manifest 스키마 확장

**파일**: `packages/compiler/src/schemas/manifest.schema.ts`

`installed_files` 외에 `appended_files` 필드 추가 (optional, 하위 호환):

```typescript
appended_files: z.array(z.string().min(1)).optional(),
```

---

## 5. init/update 커맨드 수정

**파일**: `apps/cli/src/commands/init.ts`

- `installFiles` 호출 시 `meta` 전달
- `allSkipped` 외에 `allAppended` 배열 추가, 결과 로깅
- manifest에 `appended_files` 기록

**파일**: `apps/cli/src/commands/update.ts`

- 동일하게 append 결과 반영

---

## 6. 테스트 업데이트

**파일**: `apps/cli/src/__tests__/install.test.ts`

- 기존 `non-managed 파일 → skip` 테스트를 `non-managed 파일 → append`로 변경
- append된 파일 재설치 시 섹션 교체 테스트 추가
- 섹션 마커 유무 검증

**파일**: `apps/cli/src/__tests__/uninstall.test.ts`

- append된 파일 uninstall 시 섹션만 제거되고 사용자 콘텐츠 보존 테스트

**파일**: `packages/compiler/src/__tests__/managed-header.test.ts` (신규 또는 기존 확장)

- `wrapWithSection`, `hasAiOpsSection`, `stripAiOpsSection`, `replaceAiOpsSection` 단위 테스트

**파일**: `apps/cli/src/__tests__/e2e.test.ts`

- 기존 non-managed 충돌 테스트를 append 동작으로 수정

---

## 수정 대상 파일 요약

| 파일                                                     | 변경 내용                                      |
| -------------------------------------------------------- | ---------------------------------------------- |
| `packages/compiler/src/managed-header.ts`                | 섹션 마커 유틸 함수 4개 추가                   |
| `packages/compiler/src/index.ts`                         | 새 함수 re-export                              |
| `apps/cli/src/lib/install.ts`                            | append 로직 추가, InstallResult 타입 확장      |
| `apps/cli/src/lib/uninstall.ts`                          | 섹션 제거 로직 추가, UninstallResult 타입 확장 |
| `packages/compiler/src/schemas/manifest.schema.ts`       | `appended_files` 필드 추가                     |
| `apps/cli/src/commands/init.ts`                          | append 결과 처리, manifest 기록                |
| `apps/cli/src/commands/update.ts`                        | 동일                                           |
| `apps/cli/src/__tests__/install.test.ts`                 | append 테스트                                  |
| `apps/cli/src/__tests__/uninstall.test.ts`               | 섹션 제거 테스트                               |
| `apps/cli/src/__tests__/e2e.test.ts`                     | 충돌 시나리오 수정                             |
| `packages/compiler/src/__tests__/managed-header.test.ts` | 섹션 유틸 단위 테스트                          |

---

## Verification

1. `npm run build` — 컴파일 에러 없는지 확인
2. `npm test` — 모든 테스트 통과
3. 수동 검증 시나리오:
   - 빈 프로젝트에 `init` → managed header 포함 파일 생성 (기존 동작 유지)
   - 기존 AGENTS.md가 있는 프로젝트에 `init` → 기존 내용 보존 + `<!-- ai-ops:start -->` 섹션 append
   - 같은 프로젝트에 `update` → 섹션만 교체, 사용자 내용 보존
   - `uninstall` → 섹션만 제거, 사용자 내용 보존
