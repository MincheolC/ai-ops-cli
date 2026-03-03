---
source: https://geminicli.com/docs/cli/gemini-md, https://geminicli.com/docs/reference/memport
last_fetched: 2026-02-26
---

# Context Files & Memory Import Processor Agent Instruction Manual

## 1. Core Architecture & Hierarchy

- **Execution Pipeline:** Context files are loaded, concatenated in hierarchical order, parsed for nested imports, and injected into the LLM prompt.
- **Context Tagging & Precedence:** Contexts are injected using XML tags with strict conflict resolution priority: `<project_context>` (highest) > `<extension_context>` > `<global_context>` (lowest).
- **Context Resolution Precedence (Loaded globally to locally):**

1. `Global`
2. `Environment & Workspace`
3. `Just-in-time (JIT)`

- **Import AST Architecture:** Generates a `MemoryFile` import tree representing the exact structural chain of imported dependencies.
- **Project Root Resolution:** `findProjectRoot(startDir)` executes asynchronously, traversing upwards to locate a `.git` directory without blocking the Node.js event loop.

## 2. Config & Path Specs

| Scope     | Directory / Path                                 | Capability / Purpose                                                     | Override Rules                                  |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------- |
| Global    | `~/.gemini/GEMINI.md`                            | Default persistent instructions for all projects                         | Loaded first.                                   |
| Workspace | Workspace directories & parents                  | Project-specific instructional context                                   | Appended after Global context.                  |
| JIT       | Accessed file/dir & ancestors up to trusted root | Tool-triggered, hyper-local situational context                          | Appended last. Highest specificity.             |
| Settings  | `settings.json` (`context.fileName`)             | Custom context filename resolution (e.g., `["AGENTS.md", "CONTEXT.md"]`) | Overrides the default `GEMINI.md` strict match. |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands:**
- `/memory show`: Dumps the full, concatenated context payload injected into the prompt.
- `/memory refresh`: Forces a complete filesystem re-scan and reload of all context files.
- `/memory add <text>`: Dynamically appends `<text>` to the Global `~/.gemini/GEMINI.md` file.

- **Agentic Tools:**
- `save_memory` (Function Call): Agents can autonomously persist global knowledge across sessions using this tool.

- **Special Syntax Rules:**
- **Modular Import Processor:** Use `@<path>` to embed sub-files.
- Relative formats: `@./file.md`, `@../file.md`, `@./components/file.md`
- Absolute format: `@/absolute/path/to/file.md`

- **API Signatures:**
- `processImports(content, basePath, debugMode?, importState?)` -> `Promise<{content: string, importTree: MemoryFile}>`
- `validateImportPath(importPath, basePath, allowedDirectories)` -> `boolean`

- **AST Region Ignorance:** The parser utilizes the `marked` library to construct the AST. Any `@<path>` syntax located inside `code blocks` or `inline code spans` is strictly ignored by the import processor.

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Circular Dependency Prevention:** The processor strictly tracks states and automatically blocks any circular imports (e.g., A -> B -> A).
- **Recursion Ceiling:** Import depth is hard-capped (Default: 5 levels) to prevent infinite recursion and stack overflows.
- **Security Sandboxing:** `validateImportPath` enforces directory boundaries. Referenced files outside allowed filesystem scopes will trigger graceful failure.
- **Missing Files:** Dead links or inaccessible files trigger a graceful failure, injecting an error comment string into the concatenated payload instead of crashing the agent loop.
