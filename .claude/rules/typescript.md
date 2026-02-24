# TypeScript Standards

- `type` only. `interface` 금지.
- `enum` 금지. `as const` 객체 사용.
- `any` 금지. `unknown` + type narrowing (Zod/Type Guard).
- `as` (Type Assertion) 최소화. `!` (Non-null Assertion) 금지. `?.`/`??` 사용.
- Arrow Function only. exported 함수는 return type 명시.
- `async/await` 사용. `.then()` 지양.
- `React.FC`/`FC` 금지. props 직접 타이핑 + destructure.
- `import type { ... }` 사용. Absolute Path (`@/...`) only.
- `readonly` array props, `as const` static config.
- `throw new Error(...)` only. raw string throw 금지. catch의 error는 `unknown` → narrowing.
