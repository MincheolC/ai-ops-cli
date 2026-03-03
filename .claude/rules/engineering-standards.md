<!-- managed by ai-ops -->
<!-- sourceHash: d53af8 | generatedAt: 2026-03-03T02:59:36.622Z -->

# Engineering Standards

## Constraints

- DO NOT use floating-point for money. Use minor-unit integers with ISO 4217 currency (e.g., { amount: 1099, currency: "USD" }).
- DO NOT expose sequential IDs in external APIs. Use UUIDs (prefer UUID v7).
- DO NOT store or transmit timezone-naive timestamps. Use ISO 8601 UTC (e.g., "2024-01-15T09:30:00Z").
- DO NOT use magic numbers or strings inline. Extract constants or config.
- DO NOT return inconsistent error shapes. Use { code: string, message: string, details?: unknown[] }.
- DO NOT accept unbounded input. Enforce body, array, and string size limits at the API boundary.

## Guidelines

- Use UTC end-to-end: TIMESTAMPTZ in DB, ISO 8601 UTC in API/logs, local conversion only in the presentation layer.
- Wrap API responses in a consistent envelope: { data: T | null, error: ErrorEnvelope | null, meta: { requestId: string, timestamp: string } }.
- Propagate X-Request-Id across gateway, service, logs, DB comments, and outbound calls.
- Validate environment variables at startup (e.g., Zod parse) and fail fast with all missing/invalid keys.
- Use domain error codes in DOMAIN_ACTION_REASON format (e.g., PAYMENT_CHARGE_INSUFFICIENT_FUNDS).
- Support Idempotency-Key for POST/PATCH and replay the cached response for duplicate keys within TTL.
- Expose GET /health (liveness) and GET /ready (readiness) separately.
- Return empty collections ([] or {}) instead of null.
- Handle SIGTERM gracefully: stop intake, drain in-flight requests, close resources, then exit.

## Decision Table

| When | Then | Avoid |
|------|------|-------|
| A new entity needs a primary key | Use UUID v7 | Auto-increment IDs or UUID v4 by default |
| An endpoint returns an error | Return the standard error envelope | Ad-hoc error fields (e.g., { success: false, msg }) |
| Systems exchange timestamps | Use ISO 8601 UTC in API/logs and TIMESTAMPTZ in DB; Unix epoch is acceptable in compact token formats (e.g., JWT exp/iat) | Timezone-naive strings or mixed local-time storage |
| An API needs versioning | Use URL versioning (/v1, /v2) | Header-only versioning by default |