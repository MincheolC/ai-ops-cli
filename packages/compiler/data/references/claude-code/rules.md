---
source: https://docs.anthropic.com/en/docs/claude-code/memory
last_fetched: 2026-02-26
---

# Claude Code Memory Management Agent Instruction Manual

## 1. Core Architecture & Hierarchy

**Priority Topology (Lowest to Highest Specificity):**

1. `Managed policy` (Organization-wide instructions)
2. `User rules` (`~/.claude/rules/*.md`)
3. `User memory` (`~/.claude/CLAUDE.md`)
4. `Project memory` & `Project rules` (`./CLAUDE.md`, `./.claude/CLAUDE.md`, `./.claude/rules/*.md`)
5. `Project memory (local)` (`./CLAUDE.local.md`)

**Context Injection & Loading Strategy:**

- **Parent Directories:** Loaded in full at launch (recursive lookup from CWD up to, but not including, root `/`).
- **Child Directories:** Loaded on-demand when files in subtrees are read.
- **Auto Memory:** First 200 lines of `MEMORY.md` loaded at session start. Content beyond 200 lines and modular topic files (e.g., `debugging.md`) are loaded on-demand.

## 2. Config & Path Specs

| Scope | Directory / Path | Capability / Purpose | Override Rules |
| --- | --- | --- | --- |
| **Org (macOS)** | `/Library/Application Support/ClaudeCode/CLAUDE.md` | IT/DevOps managed policy | Lowest Priority |
| **Org (Linux)** | `/etc/claude-code/CLAUDE.md` | IT/DevOps managed policy | Lowest Priority |
| **Org (Windows)** | `C:\Program Files\ClaudeCode\CLAUDE.md` | IT/DevOps managed policy | Lowest Priority |
| **User (Global)** | `~/.claude/CLAUDE.md` <br> `~/.claude/rules/*.md` | Personal preferences / workflows for all projects | Overridden by Project configs |
| **Project (Shared)** | `./CLAUDE.md` or `./.claude/CLAUDE.md` <br> `./.claude/rules/*.md` | Team-shared modular rules, testing, architecture | Overrides User configs |
| **Project (Local)** | `./CLAUDE.local.md` | Private sandbox preferences (Auto added to `.gitignore`) | Highest Priority |
| **Auto Memory** | `~/.claude/projects/<project>/memory/` | Agent's internal learnings, debug patterns, indexes | Subject to 200-line load limit |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands & Environment Variables:**
- `export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` (Force OFF) / `0` (Force ON).
- `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir <path>` (Evaluates memory files in external directories).
- `/memory` (CLI command to open file selector/system editor).
- `/init` (CLI command to bootstrap codebase `./CLAUDE.md`).

- **Special Syntax Rules (Conditional constraints, Frontmatter):**
- **Imports Syntax:** `@path/to/import` (Supports relative, absolute, and `~` home-directory paths).
- **YAML Frontmatter:** Apply target-specific scoped rules in `.claude/rules/*.md`.

```yaml
---
paths:
  - 'src/**/*.ts'
  - '{src,lib}/**/*.{ts,tsx}'
---
```

- **Glob/Brace Patterns:** `**/*.ts` (Recursive), `src/**/*` (All under dir), `*.md` (Root only), `{src,lib}` (Multiple targets).

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Import Escaping:** `@import` statements are strictly ignored inside markdown code spans and code blocks.
- **Max Recursion:** Imported files can recursively import additional files with a hard limit of **5 hops**.
- **Security Gate:** First-time cross-project/external imports prompt a one-time GUI approval dialog. If declined, imports are permanently disabled for that path.
- **Path Resolution:** The `<project>` Auto memory path strictly derives from the Git repository root. Git worktrees spawn separate memory directories. Non-Git environments default to the working directory.
- **Symlink Handling:** `.claude/rules/` resolves symlinks natively; circular symlinks are detected and bypassed.
