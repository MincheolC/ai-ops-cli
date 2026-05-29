---
name: code-review-final-gate
description: Dedupe explicit code-review-gate findings and format the final review response.
disable-model-invocation: true
---

# code-review-final-gate

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Combine findings from the focused review passes into the final response. Prefer the standard review shape:

## Findings

List concrete findings first, ordered by severity.

- `[P0]`: immediate data loss, security breach, or unusable primary workflow
- `[P1]`: likely release blocker or serious regression
- `[P2]`: important defect or missing coverage that should be fixed before merge
- `[P3]`: lower-risk issue that is still actionable

Each finding must include file/line evidence and explain the user-visible or operator-visible consequence.

## 검증

Use two groups:

- `통과:` only for checks actually run or evidence directly inspected.
- `미실행/남은 확인:` only for merge-relevant checks that still lack proof.

If there are no findings, say that clearly and keep residual risk short.
