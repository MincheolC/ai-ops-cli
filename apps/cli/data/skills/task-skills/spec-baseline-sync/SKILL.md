---
name: spec-baseline-sync
description: Update the current project's docs/specs/baseline documents from an implemented and verified .codex/plans change, then archive the completed plan and append a compact .codex/CHANGE_LOG.md entry.
disable-model-invocation: true
---

# spec-baseline-sync

Use this skill after a post-MVP change has been implemented and verified, and the team wants `./docs/specs/baseline/` to match the current product again.

## Output Location

- Update only affected files under `./docs/specs/baseline/` and `./docs/business/terminology.md` when project terminology changed.
- Move the completed plan from `./.codex/plans/<plan>.md` to `./.codex/plans/archived/YYYY-MM/<plan>.md`.
- Append a compact entry to `./.codex/CHANGE_LOG.md`.

If the change does not affect baseline truth, still archive the completed plan and write a changelog entry that says no baseline document update was required.

## Language Rules

- Write updated baseline docs in Korean unless the target file has a fixed English rule.
- Write changelog entries in Korean.
- Keep code-facing names, API field names, library/service names, protocol names, file paths, and standard technical terms in their natural English form when clearer.
- Do not force awkward phonetic transliterations.

## Required Inputs

Read the relevant available inputs before updating baseline:

1. active plan under `./.codex/plans/*.md`
2. implemented code changes, PR diff, commit diff, or implementation notes
3. verification results and known skipped tests
4. optional issue or PR link
5. existing `./docs/business/terminology.md`
6. existing `./docs/specs/baseline/05_technical-context.md`
7. existing `./docs/specs/baseline/10_product-spec.md`
8. existing `./docs/specs/baseline/20_ui-spec.md`
9. existing `./docs/specs/baseline/22_stitch-assets/DESIGN.md`
10. existing `./docs/specs/baseline/24_design-tokens.md`

Use only the files that exist and are relevant. Do not require every optional document mechanically.

## Objective

Turn a completed implementation into updated baseline truth without:

- rewriting unaffected baseline documents
- promoting planned but unimplemented ideas
- hiding implementation-vs-plan mismatches
- leaving completed plans mixed with active plans
- losing the short reason why the change happened

## Source-Of-Truth Rule

Baseline sync is implementation-confirming work.

- Treat implemented and verified product behavior as the primary source of truth.
- Treat `.codex/plans/*.md` as the intended-change and decision record.
- Treat existing baseline docs as the canonical starting point to update carefully.
- If implementation and plan disagree, update baseline to match implementation and record the mismatch in the changelog entry.
- Do not promote reverted, deferred, or unimplemented plan ideas into baseline.

## Workflow

1. Identify the plan being closed and the implementation evidence.
2. Compare shipped behavior against current baseline docs.
3. Decide whether project terminology or baseline docs among `05,10,20,22,24` are affected.
4. Update only affected baseline docs while preserving still-valid prior decisions.
5. Append one changelog entry summarizing what changed, why, evidence, baseline impact, and follow-up.
6. Move the plan into `.codex/plans/archived/YYYY-MM/`.
7. In the final response, summarize updated baseline files, archive path, changelog entry, and tests reviewed.

Use [references/template.md](references/template.md) for the changelog entry shape.

## Baseline Update Rules

- `./docs/business/terminology.md`: update only when the implementation introduced or normalized meaningful shared terms.
- `./docs/specs/baseline/05_technical-context.md`: update only when architecture, stack, boundaries, integrations, or deployment assumptions changed materially.
- `./docs/specs/baseline/10_product-spec.md`: update for implemented user-flow, feature, entity, rule, edge-case, or success-criteria changes.
- `./docs/specs/baseline/20_ui-spec.md`: update for implemented screens, states, interactions, or UI constraints.
- `./docs/specs/baseline/22_stitch-assets/DESIGN.md` and `./docs/specs/baseline/24_design-tokens.md`: update only when the implementation established reusable visual rules.
- `./docs/specs/baseline/00_brief.md` is normally out of scope. Touch it only if the product premise itself changed and the user explicitly asks.

Do not rewrite an entire baseline doc when a targeted update is enough.

## Plan Archive Rules

- Archive only completed or explicitly closed plans.
- Preserve the original filename.
- Use the archive month from the completion date, not the plan creation date, unless the user explicitly asks otherwise.
- Create `.codex/plans/archived/YYYY-MM/` if missing.
- Do not archive unrelated active plans.

## Changelog Rules

Append to `.codex/CHANGE_LOG.md`. Create the file if missing.

Each entry should include:

- date
- plan path before archive
- archived path
- issue/PR link when available
- what changed
- why it changed
- baseline docs updated, or `none`
- verification summary
- follow-up or `없음`

Keep the entry compact. The changelog is an audit trail, not a second plan.

## UI Reference Rule

Post-MVP UI changes usually come from screenshots, reference apps, and detailed adjustment requests in `.codex/plans`. Interpret those references through the current design system and implemented result.

Do not create new Stitch artifacts during baseline sync. If initial-build visual reference files already exist, update canonical visual guidance only when the implemented product established reusable design rules.

## Security Lens

Keep this pass short and implementation-confirming.

- Check whether baseline docs now need updated wording for auth, permission, tenant boundaries, admin-only surfaces, sensitive data, uploads, external callbacks, rendered content, raw queries, or destructive actions.
- Record any security-relevant change in the changelog entry.
- If implementation introduced or clarified a risky seam, recommend `spec-security-01-triage` or implementation-stage review as appropriate.

## Quality Bar

The sync is not ready if:

- baseline was updated from intent alone without checking implementation
- unaffected baseline docs were rewritten broadly
- unimplemented or deferred plan ideas were promoted
- the changelog omits what changed and why
- a completed plan remains in active `.codex/plans/`
