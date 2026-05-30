---
name: ai-ops-project-owned-docs
description: Route operating-layer notes, diff impact, or conversation learnings into the current project's project-owned docs after confirmation.
disable-model-invocation: true
---

# ai-ops-project-owned-docs

Use this skill only when the user explicitly invokes `$ai-ops-project-owned-docs` or directly asks to place operating knowledge into project-owned agent operating layer docs.

## Purpose

Turn a user note, current diff, recently solved issue, troubleshooting path, or conversation summary into a concrete project-owned documentation proposal. This skill is the single project-owned docs placement and editing specialist.

Typical inputs:

- "studio가 이제 있다보니까 구현 계획을 할 때 studio도 고려해야할 것 같은데"
- "현재 diff 때문에 운영 문서 갱신이 필요한지 봐줘"
- "좀 전에 해결한 OOO issue"
- "아까 헤맨 트러블슈팅에서 다음에도 남길 규칙이 있는지 봐줘"
- "전체 대화"

## Scope

Read only the current project root. Do not inspect parent directories, sibling repositories, the web, or external docs.

Project-owned targets include:

- `docs/agent/project-rules/*.md`
- project-owned `docs/agent/maps/*.md`
- `docs/business/*.md`
- project runbooks or operator docs already registered in `docs/docs-status.md` or `.ai-ops/context-layer.json`

Do not write project-specific rules into managed baseline docs such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/agent/rules/*`, or `docs/agent/checks/*`. Do not edit adapter docs to duplicate canonical rules.

## Inputs To Inspect

Inspect only files that exist and are relevant:

1. `AGENTS.md`
2. `docs/docs-status.md`
3. `.ai-ops/context-layer.json`
4. `docs/agent/project-rules/*.md`
5. project-owned maps, business docs, runbooks, or specs that could receive the note
6. current conversation context supplied by the user
7. current git status/diff only when the user asks for diff-based document impact

If context layer files are absent, report them as absent and continue from the files that exist.

## Input Modes

Choose exactly one input mode before classifying:

- `note-placement`: user-supplied operating note or explicit doc placement request
- `diff-impact`: current changed files may make project-owned docs stale
- `conversation-learning`: repeated user correction, review finding, troubleshooting step, or command routine from the current conversation may be worth preserving

For `diff-impact`, inspect `git status --short`, `git diff --stat`, `git diff`, `git diff --cached --stat`, `git diff --cached`, and `git ls-files --others --exclude-standard` before proposing a document target.

For `conversation-learning`, use the current conversation as the primary source. Do not invent a rule from implementation details alone.

## Classification

Classify the input into exactly one primary result:

- `project-rule`: recurring project-local agent behavior, workflow, QA, review, or implementation rule
- `project-map/runbook`: project-specific architecture, operational flow, release, launcher, or troubleshooting knowledge
- `business-doc`: domain terminology, business rule, policy, product behavior, or user-facing vocabulary
- `status-sync-only`: the content is already in a project-owned doc but status/frontmatter/context-layer needs synchronization
- `no-doc-change`: the note is too temporary, already covered, not project-owned, or belongs in managed baseline docs outside this skill's scope

Prefer existing Active project-owned docs. Propose a new project-owned doc only when no existing document can hold the rule clearly.

## Confirmation Report

Before editing, report a short proposal and wait for user confirmation.

Include:

- `classification`
- `recommended target`
- `do-not-use target`, especially any managed baseline doc that may look tempting
- `reason`
- `input mode`
- `proposed text`
- `sync needed`: whether `docs/docs-status.md`, `.ai-ops/context-layer.json`, `ai-ops update`, or `ai-ops audit` is needed
- `ask`: the exact confirmation needed from the user

Do not edit files before the user confirms the proposal.

## Edit Rules

After confirmation, edit only the approved project-owned docs and required status/index files.

- Preserve user changes and existing frontmatter.
- Do not overwrite create-only project-owned docs.
- Do not promote a `Reserved` document to `Active` without explicit approval.
- If a new project-owned doc is approved, add frontmatter and update `docs/docs-status.md` / `.ai-ops/context-layer.json` when they exist.
- If the `ai-ops` CLI is available, run `ai-ops update` or the local CLI equivalent when context-layer synchronization is needed, then run `ai-ops audit`.
- Do not stage, commit, or amend.

## Completion Report

After approved edits, report:

- changed files
- skipped candidates and why
- synchronization or audit command results
- any remaining risk or user follow-up
