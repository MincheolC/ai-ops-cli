---
name: project-terminology-sync
description: Create or update the current project's docs/business/terminology.md by standardizing project-wide domain terms, entities, states, UI labels, and English code-facing names across business docs, specs, active .codex/plans, and work packets.
disable-model-invocation: true
---

# project-terminology-sync

Use this skill when the project needs canonical terminology or when existing business docs, specs, plans, or packets have begun to drift in terminology.

Typical high-value run points are:

- after `brief`
- after `product spec`
- after `ui spec`
- during `spec-baseline-sync` if implemented terminology changed
- after business rule changes introduce new domain language
- whenever naming drift is noticed

Usually skip automatic reruns after small plans unless new shared terminology was introduced.

## Output Location

- Write into the current workspace.
- Default output path: `./docs/business/terminology.md`

## Language Rules

- Write terminology content in Korean.
- Keep code-facing English identifiers, API field names, library/service names, protocol names, file paths, and standard technical terms in their natural English form when clearer.
- Do not invent awkward Koreanized spellings for standard English technical terms.
- If a term needs explanation, keep the standard term and add a short Korean definition.

## Objective

Maintain one canonical project vocabulary so business docs, briefs, specs, UI docs, plans, packets, and baseline sync entries use the same terms for the same concepts.

The default output style is:

- tables first for fast scanning
- detailed subsections only for genuinely complex concepts
- diagrams only when relationships or state vocabularies are hard to understand in prose

## Create Or Update Rules

- If `./docs/business/terminology.md` does not exist, create it with operating-layer frontmatter from `references/template.md`.
- If it exists, update it instead of replacing it blindly.
- Preserve existing frontmatter unless the document is being promoted from `Reserved` to `Active`.
- When the document receives real terminology content, set frontmatter `status: Active`.
- If `docs/docs-status.md` exists, update the `docs/business/terminology.md` row to match the frontmatter status and owner.
- If `.ai-ops/context-layer.json` exists, update the `docs/business/terminology.md` entry so status, read/update conditions, and content hash match the file.
- Preserve stable canonical terms unless there is a strong reason to change them.
- If a newly found term conflicts with an existing definition, keep the current canonical term and record the conflict in `검토 중인 용어`.
- Normalize synonyms toward one preferred term.
- Prefer Korean for user-facing/domain wording, but keep standard English when clearer, more stable, or already established in the project.

## Recommended Inputs

Read relevant files that exist:

- `./docs/business/terminology.md`
- `./docs/business/business-rules.md`
- `./docs/specs/baseline/00_brief.md`
- `./docs/specs/baseline/05_technical-context.md`
- `./docs/specs/baseline/10_product-spec.md`
- `./docs/specs/baseline/20_ui-spec.md`
- active `./.codex/plans/*.md` when terminology from a current change needs to become canonical
- `./docs/specs/initial-build/<topic>/30_work-packets/*.md` when reviewing initial build terminology

Use only files that are present and relevant.

## Workflow

1. Identify repeated nouns, states, and labels across available docs.
2. Separate true domain concepts from incidental wording.
3. Choose one canonical project term per concept.
4. Attach English code-facing counterpart when needed.
5. Capture harmless synonyms only when useful.
6. List discouraged or banned wording when ambiguity is likely.
7. Promote `docs/business/terminology.md` from `Reserved` to `Active` if real terminology is written.
8. Write most terminology content as tables.
9. Move only hard cases into detailed sections.
10. Update `docs/docs-status.md` and `.ai-ops/context-layer.json` when they exist.
11. Update terminology without deleting still-valid prior decisions.

Use these references while drafting:

- [references/template.md](references/template.md)
- [references/checklist.md](references/checklist.md)

## Required Sections

- `핵심 용어`
- `엔티티 용어`
- `상태 용어`
- `UI 용어`
- `금지하거나 피할 표현`
- `검토 중인 용어`

## Quality Bar

The terminology document is not ready if:

- frontmatter is missing or the document has real terminology but still says `status: Reserved`
- `docs/docs-status.md` or `.ai-ops/context-layer.json` disagree with the terminology document status when those files exist
- simple vocabulary that should be in tables is expanded into unnecessary prose
- the same concept still appears under multiple primary names
- terms are listed without definitions
- code-facing English names and canonical project terms conflict without explanation
- banned or confusing wording is omitted despite clear ambiguity
- existing approved terminology is overwritten without explanation
