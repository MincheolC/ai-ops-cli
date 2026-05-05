# GraphQL Client Integration

## Constraints

- Do not use ad-hoc fetch wrappers where a shared GraphQL client stack is required.
- Do not handwrite operation/result types or rely on unchecked casts.
- Do not treat HTTP 200 as success when `errors[]` exists.
- Do not create per-feature client instances when shared auth/cache behavior is expected.
- Do not duplicate GraphQL query results into Zustand, Riverpod, or local persistent storage.

## Guidelines

- Use generated GraphQL documents and types from codegen artifacts.
- Keep one configured provider/client at the app root.
- Set cache and fetch policy explicitly per operation.
- Use the GraphQL client cache as the source of truth for GraphQL server state.
- Co-locate `.graphql` documents and fragments with the consuming feature.
- Normalize GraphQL errors and extensions into a shared UI error model.

## Decision Rules

- When a new query or mutation document is added, regenerate codegen artifacts before committing.
- When a mutation can return data and business errors together, preserve partial success and surface typed errors.
- When freshness requirements differ, choose fetch policy deliberately instead of relying on defaults.
- When a mutation changes cached entities, update the normalized cache or invalidate/refetch the affected operations deliberately.
