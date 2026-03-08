<!-- ai-ops:start -->
<!-- sourceHash: d32d57 | generatedAt: 2026-03-08T12:05:19.818Z -->

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
- Keep business logic in *.logic.ts and stateless helpers in *.util.ts.

## Decision Table

| When | Then | Avoid |
|------|------|-------|
| You feel forced to use an as assertion | Prefer schema parse (e.g., Zod) or explicit type guards first | Bypassing the type system with unchecked assertions |

---

# Libs Backend Ts

## Constraints

- DO NOT use moment/dayjs. Standardize on date-fns with named imports.
- DO NOT use jsonwebtoken. Use jose 6+.
- DO NOT handle Express req/res directly in NestJS handlers.
- DO NOT import lodash as a full bundle. Prefer native APIs or per-function imports.
- DO NOT use node-fetch/got in NestJS services. Use @nestjs/axios HttpModule or native fetch().
- DO NOT use winston/morgan/console.log for app logs. Use pino via nestjs-pino.

## Guidelines

- Use class-validator + class-transformer DTO validation with ValidationPipe({ whitelist: true }).
- Use jose for JWT sign/verify and JWKS workflows.
- Use pino + nestjs-pino as the default structured logger.
- Use rxjs operators for NestJS interceptors, guards, and event streams.
- Use Vitest + @nestjs/testing + supertest for unit/e2e tests.
- Use zod for schema validation outside DTOs (env, external payloads).
- Keep TypeScript strict mode enabled.

## Decision Table

| When | Then | Avoid |
|------|------|-------|
| JWT auth is needed | Use jose (SignJWT, jwtVerify, createRemoteJWKSet) | jsonwebtoken |
| Date handling is needed | Use date-fns named imports | moment/dayjs |
| Utility helpers are needed (clone/groupBy) | Use native JS first; fallback to scoped lodash imports only | import _ from "lodash" |
| Structured logging is needed | Use pino via nestjs-pino LoggerModule.forRoot() | console.log or mixed logging stacks |
<!-- ai-ops:end -->
