# GraphQL Server Runtime

## GraphQL Server Constraints

- Do not perform mutations in `Query` resolvers.
- Do not throw top-level GraphQL errors for expected business failures.
- Do not issue per-parent DB queries from field resolvers.
- Do not accept multiple scalar mutation arguments when a typed input object is more stable.
- Do not expose unauthenticated subscriptions in production.

## GraphQL Server Guidelines

- Keep resolvers thin and delegate business logic to services or use cases.
- Use payload types that can carry both data and typed `userErrors`.
- Apply depth and complexity limits plus operation timeout guards.
- Record `operationName` and `requestId` in structured logs.
- Document idempotency expectations for mutations with irreversible effects.

## NestJS GraphQL Constraints

- Do not put business logic in resolvers.
- Do not access raw GraphQL args/context manually when typed decorators are available.
- Do not query the DB directly inside `@ResolveField()`.
- Do not expose unauthenticated `@Subscription()` endpoints.
- Do not maintain manual SDL in code-first projects.

## NestJS GraphQL Guidelines

- Use one resolver per domain entity with clear `@Query()`, `@Mutation()`, and `@ResolveField()` responsibilities.
- Register DataLoaders as request-scoped providers.
- Add descriptions for public schema types and fields.
- Enforce depth and complexity limits in module config.
- Reuse Guards and Interceptors from REST via `GqlExecutionContext`.

## Decision Rules

- When a field resolver loads related entities, batch with DataLoader and avoid N+1.
- When a mutation can fail due to business validation, return payload data plus typed user errors.
- When auth is required, apply typed guards and avoid manual JWT parsing in resolver methods.
- When introducing subscriptions, require auth and choose a production-safe PubSub transport.
