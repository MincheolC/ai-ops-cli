# Backend Python FastAPI Runtime

## FastAPI Constraints

- Do not use plain dict or TypedDict as request or response models.
- Do not run blocking I/O in async handlers.
- Do not return ad-hoc error dicts from handlers.
- Do not place business logic in routers.
- Do not hardcode CORS origins.

## FastAPI Guidelines

- Use reusable `Depends()` providers for DB session, auth context, and services.
- Use `APIRouter` per domain with clear prefixes and tags.
- Set `response_model` explicitly.
- Use `Annotated[T, Depends(...)]` for typed dependency injection.
- Use Pydantic Settings for startup-time env validation.
- Use lifespan context managers for startup and shutdown.

## Backend Python Library Constraints

- Do not use `requirements.txt` as the primary dependency spec.
- Do not use `print()` for logging.
- Do not use `unittest.TestCase`.
- Do not rely on bare `assert` in production code.

## Backend Python Library Guidelines

- Use uv for dependency and environment management.
- Use pytest with pytest-asyncio and pytest-cov.
- Use httpx for sync and async HTTP clients.
- Use structlog and bind request-scoped context.
- Use ruff for lint and format.
- Use mypy or pyright in strict mode.
- Use pydantic-settings for env loading and validation.
- Use tenacity for retry and backoff around transient external calls.

## Decision Rules

- When an endpoint is CPU-bound, use `def` and let FastAPI run it in the threadpool.
- When an endpoint is I/O-bound, use `async def` with async drivers.
- When shared resources need setup or teardown, use lifespan context managers.
- When package management is needed, use uv with `pyproject.toml` and a lock file.
