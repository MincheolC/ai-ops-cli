<!-- managed by ai-ops -->
<!-- sourceHash: d53af8 | generatedAt: 2026-03-03T02:59:36.622Z -->

---

paths:

- "\*_/_.ts"
- "\*_/_.tsx"

---

# Typescript

## Constraints

- DO NOT use interface. Use type aliases consistently.
- DO NOT use enum. Use const objects with inferred literal unions.
- DO NOT use any. Use unknown and narrow with runtime/type guards.
- DO NOT use non-null assertion (!). Handle null/undefined explicitly with ?. and ??.
- DO NOT use .then() chains for normal async flows. Use async/await.
- DO NOT throw raw strings. Throw Error objects and narrow caught errors from unknown.

## Guidelines

- Use arrow functions only. Annotate return types for exported functions.
- Use import type for type-only imports. Use absolute paths (@/...) only.
- Use as const for static config objects.
- Keep business logic in _.logic.ts and stateless helpers in _.util.ts.

## Decision Table

| When                                   | Then                                                          | Avoid                                               |
| -------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| You feel forced to use an as assertion | Prefer schema parse (e.g., Zod) or explicit type guards first | Bypassing the type system with unchecked assertions |
