<!-- ai-ops:start -->
<!-- sourceHash: d32d57 | generatedAt: 2026-03-08T05:43:34.833Z -->

---
paths:
  - "**/*.ts"
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
