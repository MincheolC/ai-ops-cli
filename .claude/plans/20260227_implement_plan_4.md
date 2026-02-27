# Phase 4: Idempotent Install (Managed Header + Manifest I/O + Diff)

## Context

Phase 3/3′에서 Rule 렌더링(`renderForTool`)과 sourceHash 계산(`computeSourceHash`)이 완성됨.
Phase 4는 렌더링된 콘텐츠를 **대상 파일에 안전하게 설치**하기 위한 빌딩 블록을 compiler 패키지에 추가함.
Phase 5 CLI가 이 API를 조합하여 실제 파일 쓰기를 수행.

**핵심 설계 결정: Managed Block → Managed Header (Full File Ownership)**

원래 계획의 Managed Block(마커 기반 파서/교체)을 폐기하고, **파일 전체를 ai-ops가 소유 + 식별 헤더 삽입** 방식으로 단순화.

근거:

- Managed Block이 필요한 지점은 codex/gemini의 루트 파일(2곳)뿐. 마커 파싱, 사용자 영역 보존, 마커 손상 복구 등 복잡성 대비 이점 부족
- 기존 파일 충돌은 Phase 5 CLI에서 `isManagedFile` 체크 → 사용자 경고로 처리
- HTML 주석 헤더(`<!-- managed by ai-ops -->`)는 Markdown 렌더링에 영향 없음

---

## 변경 대상 파일

| 파일                                   | 변경                                                |
| -------------------------------------- | --------------------------------------------------- |
| `src/managed-header.ts`                | **신규** — Managed Header 삽입/판별/파싱/제거       |
| `src/manifest-io.ts`                   | **신규** — Manifest JSON 직렬화/역직렬화 + 파일 I/O |
| `src/diff.ts`                          | **신규** — installed_rules + sourceHash 기반 Diff   |
| `src/install-plan.ts`                  | **신규** — renderForTool 결과 → FileAction[] 변환   |
| `src/__tests__/managed-header.test.ts` | **신규**                                            |
| `src/__tests__/manifest-io.test.ts`    | **신규**                                            |
| `src/__tests__/diff.test.ts`           | **신규**                                            |
| `src/__tests__/install-plan.test.ts`   | **신규**                                            |
| `src/index.ts`                         | barrel export 확장                                  |

Schema 변경 **없음**. 기존 코드 변경 **없음**.

---

## Step 1. `managed-header.ts`

```ts
const MANAGED_MARKER = '<!-- managed by ai-ops -->';

// content → 헤더 + 메타 줄 + 빈 줄 + content
wrapWithHeader(content: string, meta: { sourceHash: string; generatedAt: string }): string

// 파일 첫 줄이 MANAGED_MARKER인지
isManagedFile(content: string): boolean

// 헤더에서 sourceHash, generatedAt 추출 (없으면 null)
parseManagedHeader(content: string): { sourceHash: string; generatedAt: string } | null

// 헤더 제거 → 순수 컨텐츠 반환
stripManagedHeader(content: string): string
```

출력 형식:

```md
<!-- managed by ai-ops -->
<!-- sourceHash: a1b2c3 | generatedAt: 2026-02-27T... -->

(실제 룰 컨텐츠)
```

## Step 2. `manifest-io.ts`

```ts
const MANIFEST_FILENAME = '.ai-ops-manifest.json';

// Pure
parseManifest(json: string): Manifest          // JSON.parse + Zod 검증
serializeManifest(manifest: Manifest): string   // JSON.stringify(2) + '\n'

// I/O (Imperative Shell)
resolveManifestPath(basePath: string): string   // basePath + MANIFEST_FILENAME
readManifest(manifestPath: string): Manifest | null   // 없으면 null, 파싱실패 throw
writeManifest(manifestPath: string, manifest: Manifest): void  // mkdirSync recursive
```

기존 `source-hash.ts`의 `buildManifest`를 소비하여 Manifest 객체 생성 → `writeManifest`로 저장.

## Step 3. `diff.ts`

```ts
type DiffResult = {
  status: 'up-to-date' | 'changed';
  added: readonly string[];       // 새 rule IDs
  removed: readonly string[];     // 삭제된 rule IDs
  sourceChanged: boolean;         // SSOT 내용 변경 여부
};

// Pure Function
computeDiff(params: {
  previous: Manifest;
  currentRules: readonly string[];    // 현재 preset에서 resolve된 rule ID[]
  currentSourceHash: string;
}): DiffResult
```

- `installed_rules` vs `currentRules` → Set 비교 → added/removed
- `previous.sourceHash` vs `currentSourceHash` → sourceChanged
- 셋 중 하나라도 있으면 `'changed'`

## Step 4. `install-plan.ts`

```ts
type FileAction = {
  relativePath: string;   // basePath 기준 상대 경로
  content: string;        // managed header 포함 최종 컨텐츠
};

// renderForTool 결과 → 파일 쓰기 계획 (Pure)
buildInstallPlan(params: {
  toolId: ToolId;
  renderResult: ToolRenderResult;
  meta: { sourceHash: string; generatedAt: string };
}): readonly FileAction[]
```

도구별 매핑:

- `claude-code` → `.claude/rules/{id}.md` (파일당 1개)
- `codex` → `AGENTS.md` (rootContent) + `AGENTS.override.md` (domainContent)
- `gemini` → `GEMINI.md` (rootContent) + `GEMINI.md` (domainContent)
- 빈 `rootContent`/`domainContent` → 해당 FileAction 생략 (5-D3 반영)

> 모노레포 워크스페이스 prefix는 Phase 5 CLI에서 `relativePath` 앞에 추가.

## Step 5. `index.ts` barrel export 확장

4개 신규 모듈 추가.

---

## 테스트 케이스

### managed-header.test.ts

- `wrapWithHeader`: 헤더 + 메타 + 빈줄 + 컨텐츠 형식
- `isManagedFile`: managed → true, 일반 → false, 빈 문자열 → false
- `parseManagedHeader`: 정상 파싱, 헤더 없음 → null, 메타 형식 깨짐 → null
- `stripManagedHeader`: 헤더 제거, 비관리 파일 → 원본 그대로
- 멱등성: `wrapWithHeader` → `stripManagedHeader` → 원본 복원

### manifest-io.test.ts

- `parseManifest`: 유효 → Manifest, 잘못된 JSON → throw, Zod 실패 → throw
- `serializeManifest`: pretty-print + 줄바꿈
- roundtrip: `serialize` → `parse` → 동일 객체
- `readManifest`: 파일 없음 → null, 유효 파일 → Manifest
- `writeManifest` → `readManifest` 왕복, 중간 디렉토리 자동 생성

### diff.test.ts

- 동일 rules + 동일 hash → `up-to-date`
- rule 추가 → added
- rule 제거 → removed
- rules 동일 + hash 다름 → sourceChanged
- 복합: 추가 + 제거 + hash 변경 동시
- 빈 installed_rules → 전체 added
- 빈 currentRules → 전체 removed

### install-plan.test.ts

- claude-code: files → `.claude/rules/` 경로 + 헤더 포함
- codex: root + domain → 2 FileAction
- codex: 빈 domainContent → root만 1 FileAction
- gemini: 동일 구조
- 모든 도구: content에 managed header 포함 확인

---

## 구현 순서

1. `managed-header.ts` + 테스트 (의존 없음)
2. `manifest-io.ts` + 테스트 (schemas 의존, I/O 테스트는 tmp dir)
3. `diff.ts` + 테스트 (schemas 타입만 의존, 순수 함수)
4. `install-plan.ts` + 테스트 (renderer + tool-output + managed-header 의존)
5. `index.ts` barrel export
6. `npm run build && npx vitest run` 전체 통과

---

## Verification

```bash
cd packages/compiler
npx vitest run src/__tests__/managed-header.test.ts
npx vitest run src/__tests__/manifest-io.test.ts
npx vitest run src/__tests__/diff.test.ts
npx vitest run src/__tests__/install-plan.test.ts
npx vitest run                    # 전체 regression
npm run build                     # tsup ESM 빌드
```
