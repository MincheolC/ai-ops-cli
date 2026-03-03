<!-- managed by ai-ops -->
<!-- sourceHash: d53af8 | generatedAt: 2026-03-03T02:59:36.622Z -->

# Code Philosophy

## Constraints

- DO NOT write clever or opaque code. Prefer explicit intent over tricks.
- DO NOT extract shared abstractions before the Rule of Three.
- DO NOT mutate state. Use const/final and spread operators for immutability.
- DO NOT mix side effects into core business functions.

## Guidelines

- Optimize for readability and maintainability first.
- Prefer temporary duplication over premature abstraction.
- For non-trivial business rules, start with a failing test (TDD).
- Use a functional-core / imperative-shell structure.
- Use immutable updates (const/final, copy/spread patterns).

## Decision Table

| When                                         | Then                                                     | Avoid                               |
| -------------------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| Implementing complex business logic          | Write failing tests first, then implement pure functions | Implementation-first with mixed I/O |
| Similar code appears in two places           | Keep duplication temporarily                             | Early shared abstraction            |
| Similar code appears in three or more places | Extract a clearly named shared function                  |                                     |
