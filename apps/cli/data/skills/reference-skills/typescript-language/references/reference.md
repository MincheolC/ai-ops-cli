# TypeScript Language

## Constraints

- Do not use `interface`. Use type aliases consistently.
- Do not use `enum`. Use const objects with inferred literal unions.
- Do not use `any`. Use `unknown` and narrow it explicitly.
- Do not use non-null assertion (`!`).
- Do not use `.then()` chains for normal async flows.
- Do not throw raw strings.

## Guidelines

- Annotate exported function return types.
- Use `import type` for type-only imports.
- Use `as const` for static config objects.
- Keep business logic in `*.logic.ts` and stateless helpers in `*.util.ts`.

## Decision Rules

- When a runtime value must be narrowed, prefer explicit guards or schema parsing.
- When a static config object defines literals, prefer `as const`.
- When you feel forced to use `as`, prefer schema parse or explicit guards first.
