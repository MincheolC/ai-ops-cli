---
name: code-review-security
description: Review explicit code-review-gate targets for auth, ownership, secret, PII, and permission risks.
disable-model-invocation: true
---

# code-review-security

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Check security-sensitive changes first:

- authentication, authorization, ownership, tenancy, or role checks
- token, session, credential, secret, or PII handling
- filesystem, network, sandbox, hook, or command execution boundaries
- rate limit, replay, idempotency, and audit-log expectations
- install/uninstall paths that could remove or overwrite user-owned files

Report only actionable risks. If the target is low risk, say so briefly with the evidence surface checked.
