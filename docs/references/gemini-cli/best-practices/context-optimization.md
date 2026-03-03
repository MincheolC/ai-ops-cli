# Agent Context Optimization Strategies

This document outlines architectural patterns and best practices for managing context payload effectively within the Gemini CLI environment, moving beyond the mechanical features defined in the official specification.

## The Challenge: Context Bloat

The Gemini CLI's memory import processor (`@<path>`) is powerful but eager: it synchronously reads and injects the entire target file into the agent's system prompt during initialization. As project rules (`apps/cli/data/rules/*.yaml`) grow in number and detail, importing them all globally causes:

1. **Token Exhaustion:** Wasting context window on irrelevant domains (e.g., loading Python rules while working on a React component).
2. **Attention Dilution:** Increasing the likelihood that the LLM misses or misinterprets instructions due to information overload.

## The Solution: Lazy-Loading via Rule Registry

Instead of pushing all rules via direct imports, we employ an agentic workflow that leverages the AI's autonomous tool-use capabilities.

### 1. Base Context (Global)

Only universally applicable, lightweight rules should be directly imported into `~/.gemini/GEMINI.md` or `.gemini/GEMINI.md`.

- `role-persona`
- `communication`
- `code-philosophy`

### 2. The Rule Registry

Instead of importing domain-specific rules, inject a **"Rule Registry"** (an index or table of contents) into the base context. This instructs the agent _where_ to find the rules and _when_ to read them.

**Example Registry Injection:**

```markdown
# 🚨 Dynamic Rule Loading (CRITICAL)

DO NOT guess the architectural or stylistic rules. Before modifying or generating code, you MUST use the `read_file` tool to load the relevant rule configurations based on the tech stack you are working on.

**Rule Registry Location:** `apps/cli/data/rules/*.yaml`

**Mapping:**

- **Python / Backend**: Read `python.yaml`, `fastapi.yaml`, `libs-backend-python.yaml`
- **React / Frontend**: Read `react-typescript.yaml`, `nextjs.yaml`, `shadcn-ui.yaml`
- **Database**: Read `sqlalchemy.yaml` or `prisma-postgresql.yaml`
```

### 3. Agent Execution Flow

1. The user requests a task (e.g., "Create a new FastAPI router").
2. The agent reads the base context and sees the Rule Registry.
3. Recognizing the "FastAPI" domain, the agent **autonomously calls `read_file`** to load `fastapi.yaml` and `python.yaml` before writing any code.

## Summary

- **DO NOT** use `@<path>` for large, domain-specific rulesets.
- **DO** use `@<path>` for core, universal persona/philosophy guidelines.
- **DO** implement a Rule Registry to force the agent to lazy-load context conditionally using the `read_file` tool.
