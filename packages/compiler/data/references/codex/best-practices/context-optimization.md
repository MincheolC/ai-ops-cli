# Agent Context Optimization Strategies (Codex)

This document defines practical patterns for minimizing instruction payload while preserving rule fidelity in Codex AGENTS.md-based workflows.

## The Challenge: Instruction Bloat

Codex builds the instruction chain once at run start, then executes with that merged payload. In large monorepos, broad AGENTS files can create:

1. Token waste from irrelevant domain rules.
2. Lower instruction salience from high-density prompts.
3. Hard truncation risk when `project_doc_max_bytes` is reached.

## Codex Loading Model (Why Optimization Works)

From `references/codex/rules.md`, the important mechanics are:

- Discovery scope: global + project path from repo root to current working directory (CWD).
- Merge order: root to CWD (later files naturally override earlier ones).
- Directory ceiling: only one instruction file per directory (`AGENTS.override.md` > `AGENTS.md` > fallback names).
- Byte ceiling: concatenation stops when `project_doc_max_bytes` is hit (default `32768`).

These constraints make path and file placement the primary optimization levers.

## Solution 1: CWD-Scoped Execution (Preferred)

Run Codex from the narrowest directory that matches the task.

```bash
codex --cd packages/frontend "Implement the new settings panel."
codex --cd packages/backend "Add FastAPI pagination to list endpoint."
```

Effect:

- Loads only global + root-to-target-directory instructions.
- Excludes unrelated sibling-domain instruction files by construction.

## Solution 2: Hierarchical Rule Partitioning

Keep global instructions minimal and push domain rules down the tree.

Recommended layout:

```txt
repo/
  AGENTS.md                      # global: persona, communication, universal guardrails
  packages/
    frontend/
      AGENTS.md                  # frontend-specific standards
    backend/
      AGENTS.md                  # backend-specific standards
    data-pipeline/
      AGENTS.md                  # data/ETL-specific standards
```

Guidelines:

- Root AGENTS: only cross-cutting rules needed for every task.
- Subdirectory AGENTS: only rules needed inside that subtree.
- Avoid duplicating large shared blocks across multiple directories.

## Solution 3: Budget-Aware Instruction Design

Treat `project_doc_max_bytes` as a strict budget, not a soft target.

Guidelines:

- Keep each AGENTS file concise and non-redundant.
- Move large reference content out of AGENTS into external docs.
- Keep AGENTS focused on executable constraints and decision rules.
- Raise `project_doc_max_bytes` only after sharding is exhausted.

## Solution 4: Manual Lazy-Loading via Rule Registry (Fallback)

For heavy or cross-cutting guidance that cannot be cleanly path-scoped, keep only an index in AGENTS and require on-demand reads.

Example registry snippet for root `AGENTS.md`:

```markdown
# Dynamic Rule Loading (Critical)

Do not guess architecture or style constraints.
Before editing code, read the relevant rule files from:
`packages/compiler/data/rules/*.yaml`

Mapping:

- Python/Backend: `python.yaml`, `fastapi.yaml`, `libs-backend-python.yaml`
- React/Frontend: `react-typescript.yaml`, `nextjs.yaml`, `shadcn-ui.yaml`
- Database: `sqlalchemy.yaml` or `prisma-postgresql.yaml`
- GraphQL: `graphql.yaml`, `nestjs-graphql.yaml`
```

This preserves a small base context while still enforcing domain rules when needed.

## Verification Loop

Use runtime checks to confirm active context and prevent hidden overloading:

```bash
codex --ask-for-approval never "Summarize the current instructions."
codex --cd <dir> --ask-for-approval never "Show which instruction files are active."
```

## Decision Matrix

| Scenario                                  | Recommended Strategy |
| ----------------------------------------- | -------------------- |
| Task is isolated to one package/subtree   | Solution 1 + 2       |
| Rules map cleanly to directory boundaries | Solution 2           |
| AGENTS payload approaches byte cap        | Solution 3           |
| Rules are cross-cutting and high-volume   | Solution 4           |

## Summary

- Do scope execution with `--cd` to minimize loaded instruction chain.
- Do keep root AGENTS minimal; move specialized rules to deeper directories.
- Do design for `project_doc_max_bytes` proactively.
- Do use a rule registry + on-demand reads for heavy guidance.
- Do not place large, domain-specific rule bodies in global AGENTS.
