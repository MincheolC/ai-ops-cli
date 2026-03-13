# Prisma PostgreSQL

## Constraints

- Do not interpolate strings in unsafe raw SQL APIs.
- Do not return Prisma models directly from API boundaries.
- Do not define mutable models without `updatedAt`.
- Do not use `$use()` middleware in Prisma v7+ patterns.
- Do not use `prisma db push` in production.

## Guidelines

- Use the Prisma client generator/output layout that matches the current repo convention.
- Use explicit pool and timeout settings.
- Add indexes for common where/orderBy/join patterns.
- Set explicit timeout and `maxWait` for interactive transactions.
- Centralize datasource and migration settings.
- Implement soft delete consistently.
- Prefer cursor pagination over deep skip/take on large tables.
- Use external pooling or explicit connection limits for serverless/container workloads.

## Decision Rules

- When Prisma API cannot express PostgreSQL behavior cleanly, use parameterized raw SQL with typed result mapping.
- When a transaction has dependent steps, use interactive transactions with explicit timeout and wait settings.
