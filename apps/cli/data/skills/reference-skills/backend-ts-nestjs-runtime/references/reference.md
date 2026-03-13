# Backend TS NestJS Runtime

## NestJS Constraints

- Do not use `@Res()` or `@Response()` for normal route handling.
- Do not put business logic in controllers.
- Do not use `forwardRef()` as a default circular dependency fix.
- Do not read `process.env` directly in services or controllers.
- Do not use `console.log` for app logging.

## NestJS Guidelines

- Organize by feature module.
- Use DTO validation at request boundaries.
- Register global validation, filters, and guards in bootstrap.
- Use custom `HttpException` types for domain failures.
- Use Swagger decorators for REST contracts.

## Backend TS Library Constraints

- Do not use moment/dayjs.
- Do not use jsonwebtoken.
- Do not handle Express req/res directly in NestJS handlers.
- Do not import lodash as a full bundle.
- Do not use node-fetch/got in NestJS services.
- Do not use winston, morgan, or console logging.

## Backend TS Library Guidelines

- Use class-validator and class-transformer DTO validation.
- Use jose for JWT sign/verify and JWKS workflows.
- Use pino via nestjs-pino for structured logs.
- Use rxjs operators in interceptors, guards, and event streams.
- Use Vitest with @nestjs/testing and supertest.
- Use zod outside DTO boundaries.
- Keep TypeScript strict mode enabled.

## Decision Rules

- When auth or roles depend on handler metadata, use guards.
- When response transformation or timing is needed, use interceptors.
- When JWT auth is needed, use jose.
- When structured logging is needed, use pino via nestjs-pino.
