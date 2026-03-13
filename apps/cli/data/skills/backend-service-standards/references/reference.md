# Backend Service Standards

## Constraints

- Do not use floating-point for money. Use minor-unit integers with ISO 4217 currency.
- Do not expose sequential ids in external APIs. Use UUIDs, preferably UUID v7.
- Do not store or transmit timezone-naive timestamps.
- Do not use magic numbers or strings inline when the value is policy or protocol relevant.
- Do not return inconsistent error shapes.
- Do not accept unbounded input at API boundaries.

## Guidelines

- Use UTC end-to-end across API, logs, and persistence.
- Wrap API responses in a consistent envelope with `data`, `error`, and `meta`.
- Propagate `X-Request-Id` across gateway, service, logs, DB comments, and outbound calls.
- Validate environment variables at startup and fail fast.
- Use domain-specific error codes in `DOMAIN_ACTION_REASON` format.
- Support `Idempotency-Key` for POST/PATCH where replay safety matters.
- Expose `GET /health` and `GET /ready` separately.
- Return empty collections instead of `null`.
- Handle `SIGTERM` gracefully by stopping intake, draining in-flight work, closing resources, and then exiting.

## Decision Rules

- When a new entity needs a primary key, use UUID v7 and avoid auto-increment ids.
- When an endpoint returns an error, return the standard error envelope and avoid ad-hoc error fields.
- When systems exchange timestamps, use ISO 8601 UTC in APIs/logs and timezone-aware DB types.
- When an API needs versioning, prefer URL versioning over header-only versioning.
