---
name: spec-shared-glossary-sync
description: Create or update a Korean 01_glossary.md inside the current project's docs/specs/baseline directory by standardizing domain terms, entities, states, UI labels, and English code-facing names across baseline docs and active .codex/plans.
disable-model-invocation: true
---

# spec-shared-glossary-sync

Use this skill when the project needs a shared glossary or when existing docs/specs/plans have begun to drift in terminology.

Typical high-value run points are:

- after `brief`
- after `product spec`
- after `ui spec`
- during `spec-baseline-sync` if implemented terminology changed
- whenever naming drift is noticed

Usually skip automatic reruns after small plans unless new shared terminology was introduced.

## Output Location

- Write into the current workspace.
- Default output path: `./docs/specs/baseline/01_glossary.md`

## Language Rules

- Write the glossary in Korean.
- Keep code-facing English identifiers, API field names, library/service names, protocol names, file paths, and standard technical terms in their natural English form when clearer.
- Do not invent awkward Koreanized spellings for standard English technical terms.
- If a term needs explanation, keep the standard term and add a short Korean definition.

## Objective

Maintain one canonical vocabulary so briefs, specs, UI docs, plans, packets, and baseline sync entries use the same terms for the same concepts.

The default output style is:

- tables first for fast scanning
- detailed subsections only for genuinely complex concepts
- diagrams only when relationships or state vocabularies are hard to understand in prose

## Create Or Update Rules

- If `./docs/specs/baseline/01_glossary.md` does not exist, create it from currently approved specs and relevant active plans.
- If it exists, update it instead of replacing it blindly.
- Preserve stable canonical terms unless there is a strong reason to change them.
- If a newly found term conflicts with an existing definition, keep the current canonical term and record the conflict in `정의 충돌 / 검토 필요`.
- Normalize synonyms toward one preferred term.
- Prefer Korean for user-facing/domain wording, but keep standard English when clearer, more stable, or already established in the project.

## Recommended Inputs

Read relevant files that exist:

- `./docs/specs/baseline/00_brief.md`
- `./docs/specs/baseline/05_technical-context.md`
- `./docs/specs/baseline/10_product-spec.md`
- `./docs/specs/baseline/20_ui-spec.md`
- active `./.codex/plans/*.md` when terminology from a current change needs to become canonical
- `./docs/specs/initial-build/<topic>/30_work-packets/*.md` when reviewing initial build terminology
- existing `./docs/specs/baseline/01_glossary.md`

Use only files that are present and relevant.

## Workflow

1. Identify repeated nouns, states, and labels across available docs.
2. Separate true domain concepts from incidental wording.
3. Choose one canonical project term per concept.
4. Attach English code-facing counterpart when needed.
5. Capture harmless synonyms only when useful.
6. List discouraged or banned wording when ambiguity is likely.
7. Write most glossary content as tables.
8. Move only hard cases into detailed sections.
9. Update the glossary without deleting still-valid prior decisions.

Use these references while drafting:

- [references/template.md](references/template.md)
- [references/checklist.md](references/checklist.md)

## Required Sections

- `핵심 용어`
- `엔티티 용어`
- `상태 용어`
- `UI 용어`
- `금지하거나 피할 표현`
- `복잡한 개념 상세 설명`
- `정의 충돌 / 검토 필요`

## Quality Bar

The glossary is not ready if:

- simple vocabulary that should be in tables is expanded into unnecessary prose
- the same concept still appears under multiple primary names
- terms are listed without definitions
- code-facing English names and canonical project terms conflict without explanation
- banned or confusing wording is omitted despite clear ambiguity
- existing approved terminology is overwritten without explanation
