# Core Rule Authoring Guide

This guide applies only to `apps/cli/data/rules/*.yaml`.

## Scope

Rule YAML is now reserved for always-loaded general rules only.

Current core rule set:

| priority | id |
| --- | --- |
| 90 | role-persona |
| 85 | communication |
| 80 | code-philosophy |
| 75 | naming-convention |
| 71 | plan-mode |

If guidance is stack/framework/library/domain-specific, it should not be added here. It belongs in `apps/cli/data/skills/<skill-id>/`.

## Schema

```yaml
id: kebab-case-only
category: persona
tags:
  - general
priority: 90
supported_tools:
  - claude-code
  - codex
  - gemini
content:
  constraints:
    - 'DO NOT ...'
  guidelines:
    - '...'
  decision_table:
    - when: '...'
      then: '...'
      avoid: '...'
```

Reference: `apps/cli/src/core/schemas/rule.schema.ts`

## Rules for Adding or Updating a Core Rule

1. The rule must be stack-agnostic.
2. The rule must be safe to always load.
3. The rule must be short enough to justify permanent context cost.
4. The file name must match `id`.
5. `priority` must remain unique.

## Constraints vs Guidelines

| Use | Meaning |
| --- | --- |
| `constraints` | hard “DO NOT” rules that prevent clear quality or safety regressions |
| `guidelines` | positive defaults and preferred working style |
| `decision_table` | conditional rule for context-sensitive choices |

## When to Create a Skill Instead

Use a skill when the content is any of the following:

- TypeScript or Python language guidance
- framework/runtime guidance such as Next.js, NestJS, FastAPI, Flutter
- GraphQL client/server conventions
- database or migration guidance
- large backend standards packs
- repeatable operational workflows

Reference skills keep detailed content in `references/reference.md`. Task skills keep the procedure in `SKILL.md`.

## Validation

```bash
npm run test --workspace=apps/cli
npm run build --workspace=apps/cli
```
