# SQLAlchemy PostgreSQL

## Constraints

- Do not use legacy `session.query()` patterns.
- Do not execute raw SQL strings directly outside migrations.
- Do not call `session.commit()` from scattered layers.
- Do not omit `created_at` and `updated_at` on mutable models.
- Do not change schema without Alembic migrations.

## Guidelines

- Use `Mapped[T]` and `mapped_column()` declarative mappings.
- Define relationships explicitly with `back_populates`.
- Use `AsyncSession` and `async_sessionmaker` for async stacks.
- Implement soft delete consistently.
- Prefer migration-safe string enums.
- Declare indexes and unique constraints explicitly.
- Prevent N+1 with explicit loading strategy. Do not rely on lazy loading by default.

## Decision Rules

- When routine CRUD is needed, prefer ORM expressions.
- When complex analytical SQL is needed, use parameterized `text()` or a fit-for-purpose analytical engine.
- When schema changes are required, generate and review Alembic migrations before applying them.
