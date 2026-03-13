# GraphQL Contract

## Constraints

- Do not rely on implicit nullability. Mark every field intentionally.
- Do not return unbounded lists. Every collection needs bounded pagination with a stable cursor.
- Do not expose internal implementation details in enum values.
- Do not rename or remove published fields or types in the same release. Deprecate first.

## Guidelines

- Use PascalCase for types/enums, camelCase for fields/arguments, and SCREAMING_SNAKE_CASE for enum values.
- Prefer cursor pagination for user-facing lists and reserve offset pagination for bounded admin tables.
- Use typed `FilterInput` and `OrderByInput` instead of JSON-like free-form arguments.
- Document scalar contracts such as `DateTime`, `UUID`, and `JSON`, including timezone and format rules.

## Decision Rules

- When a field returns a collection, use cursor pagination with deterministic ordering.
- When a field or type must be renamed or removed, mark it deprecated with a migration reason and keep compatibility for at least one release.
- When a schema change is high-risk, add usage checks, rollback criteria, and a revert path before shipping.
- When filtering or sorting is complex, define typed inputs and avoid raw JSON blobs.
