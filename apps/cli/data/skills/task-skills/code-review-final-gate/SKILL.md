---
name: code-review-final-gate
description: Dedupe explicit code-review-gate findings and format the final review response.
disable-model-invocation: true
---

# code-review-final-gate

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Combine findings from the focused review passes into the final response. Keep only actionable, evidence-backed findings; drop duplicates, speculation, style-only notes, and no generic advice.

## Scope compliance

Respect the scope map. Drop findings outside the `included surface`, do not promote the `excluded surface` into findings, and record out-of-scope risk only under `미실행/남은 확인`. For `project_wide`, feature, and module reviews, mention the inspected and excluded surfaces briefly in `**검증**`.

## Final response contract

Use these headings exactly:

**Findings**

List concrete findings first, ordered by severity.

- `[P0]` immediate data loss, security breach, or unusable primary workflow
- `[P1]` likely release blocker or serious regression
- `[P2]` important defect or missing coverage that should be fixed before merge
- `[P3]` lower-risk issue that is still actionable

Each finding must include file/line evidence and explain the user-visible, operator-visible, or reviewer-visible consequence. Do not force a fixed number of findings; zero findings is valid.

**검증**

Use two groups:

- `통과:` only for checks actually run or evidence directly inspected.
- `미실행/남은 확인:` only for merge-relevant checks that still lack proof.

If there are no findings, write `없음.` under `**Findings**` and keep residual risk short. Never present planned checks as passed.
