---
name: code-review-security
description: Review explicit code-review-gate targets for auth, ownership, secret, PII, and permission risks.
disable-model-invocation: true
---

# code-review-security

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Check security-sensitive changes first.

## Review lens

Check for:

- missing or weakened authentication, authorization, ownership, tenancy, or role checks
- token, session, credential, secret, or PII exposure in logs, manifests, generated files, prompts, or test fixtures
- sandbox, command execution, filesystem, path traversal, symlink, or network boundary regressions
- user-owned file overwrite/removal during install, update, uninstall, cleanup, or generated asset refresh
- hook, receipt, or agent automation behavior that can run implicitly without an explicit user action
- replay, rate limit, idempotency, or audit-log gaps when the change creates an external side effect

## Evidence protocol

1. Identify whether the target crosses auth/authz, filesystem, command, network, hook, or credential boundaries.
2. Inspect the boundary code and the tests or fixtures that prove ownership checks.
3. Report only actionable risks with file/line evidence.
4. Apply no generic advice: do not recommend generic hardening unless the reviewed diff creates a concrete exploit, data leak, or user-owned file risk.

If the target is low risk, say so briefly with the security-sensitive surfaces checked.
