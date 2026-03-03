# Agent Context Optimization Strategies (Claude Code)

This document outlines architectural patterns and best practices for managing context payload effectively within the Claude Code environment, building on the official specification in `references/claude-code/rules.md`.

## The Challenge: Context Bloat

Claude Code's memory system eagerly loads CLAUDE.md files at session start (recursive lookup from CWD upward). Using `@import` to pull in domain-specific rules globally causes:

1. **Token Exhaustion:** Loading Python rules while working on a React component wastes context window.
2. **Attention Dilution:** Increased instruction density raises the likelihood of the LLM missing or misinterpreting rules.

## Solution 1: Path-Scoped Rules (Claude Code Native — Preferred)

Claude Code has a **native lazy-loading mechanism** that Gemini CLI lacks: `paths:` frontmatter in `.claude/rules/*.md`.

Rules are automatically activated **only** when the agent reads a file matching the declared glob pattern. No manual registry required.

```yaml
# .claude/rules/react-typescript.md
---
paths:
  - 'src/**/*.tsx'
  - 'src/**/*.ts'
---
# React & TypeScript Rules
...
```

```yaml
# .claude/rules/python.md
---
paths:
  - '**/*.py'
  - 'pyproject.toml'
---
# Python Rules
...
```

**Result:** The agent loads Python rules only when it opens a `.py` file. React rules only when touching `.tsx`. Zero manual orchestration.

### Recommended Rule File Layout

```
.claude/
  rules/
    role-persona.md          # No paths: → always loaded (global)
    communication.md         # No paths: → always loaded (global)
    code-philosophy.md       # No paths: → always loaded (global)
    typescript.md            # paths: src/**/*.ts
    react-typescript.md      # paths: src/**/*.tsx
    nextjs.md                # paths: src/app/**, next.config.*
    python.md                # paths: **/*.py
    fastapi.md               # paths: **/routers/**, **/main.py
    prisma-postgresql.md     # paths: prisma/**, **/*.prisma
```

## Solution 2: Child Directory CLAUDE.md (Package-Level Isolation)

In monorepos, place domain-specific rules in the package's own `.claude/CLAUDE.md`. Claude Code only loads these **on-demand** when files in that subtree are read.

```
monorepo/
  .claude/CLAUDE.md              # Global: persona, communication, philosophy
  packages/
    frontend/
      .claude/CLAUDE.md          # Loaded only when working in frontend/
    backend/
      .claude/CLAUDE.md          # Loaded only when working in backend/
    data-pipeline/
      .claude/CLAUDE.md          # Loaded only when working in data-pipeline/
```

**Caveat:** Requires that Claude actually reads a file within the subtree to trigger loading. Does not activate based on directory navigation alone.

## Solution 3: Manual Rule Registry (Fallback)

Use when Solutions 1 and 2 are insufficient — for example, when rules cannot be mapped to file path patterns (e.g., architecture decisions, API design guidelines).

Inject a **Rule Registry** into the base CLAUDE.md instructing the agent to self-load rules using the `Read` tool:

```markdown
# 🚨 Dynamic Rule Loading (CRITICAL)

DO NOT guess architectural or stylistic rules. Before modifying or generating
code, you MUST use the Read tool to load the relevant rule file based on the
tech stack you are working on.

**Rule Registry Location:** `apps/cli/data/rules/*.yaml`

**Mapping:**

- **Python / Backend**: Read `python.yaml`, `fastapi.yaml`, `libs-backend-python.yaml`
- **React / Frontend**: Read `react-typescript.yaml`, `nextjs.yaml`, `shadcn-ui.yaml`
- **Database**: Read `sqlalchemy.yaml` or `prisma-postgresql.yaml`
- **GraphQL**: Read `graphql.yaml`, `nestjs-graphql.yaml`
```

## Decision Matrix

| Scenario                                   | Recommended Solution                          |
| ------------------------------------------ | --------------------------------------------- |
| Rules map cleanly to file extensions/paths | **Solution 1** — `paths:` frontmatter         |
| Monorepo with clearly separated packages   | **Solution 2** — Child directory CLAUDE.md    |
| Cross-cutting rules not tied to file paths | **Solution 3** — Manual Rule Registry         |
| Universal rules (persona, communication)   | No optimization needed — always load globally |

## Summary

- **DO** use `paths:` frontmatter for domain-specific rules. This is Claude Code's native, zero-overhead lazy-loading.
- **DO** place package-level rules in child `.claude/CLAUDE.md` in monorepos.
- **DO NOT** use `@import` for large, domain-specific rulesets in the global CLAUDE.md.
- **DO** keep globally loaded rules minimal: persona, communication, core philosophy only.
- **DO** fall back to a Manual Rule Registry only when path-scoping is impossible.
