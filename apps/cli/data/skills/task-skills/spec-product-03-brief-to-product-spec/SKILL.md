---
name: spec-product-03-brief-to-product-spec
description: Expand an approved Korean 00_brief.md and 05_technical-context.md into a Korean 10_product-spec.md in the current project's docs/specs/baseline directory with concrete user flows, features, entities, business rules, edge cases, and success criteria while preserving approved scope and stack constraints.
disable-model-invocation: true
---

# spec-product-03-brief-to-product-spec

Use this skill after `./docs/specs/baseline/00_brief.md` and `./docs/specs/baseline/05_technical-context.md` are approved and the next artifact should be `./docs/specs/baseline/10_product-spec.md`.

## Output Location

- Write into the current workspace.
- Default output path: `./docs/specs/baseline/10_product-spec.md`

## Language Rules

- Write the document in Korean.
- Keep code-facing names, API field names, library/service names, protocol names, file paths, and widely used technical terms in their natural English form when that is clearer and more standard.
- Do not force awkward phonetic transliterations such as `소스 오브 트루스`, `타겟 플랫폼`, or `워크 패킷`.
- If an English technical term needs explanation, keep the English term and add a short Korean gloss on first mention, for example `source of truth(가장 신뢰하는 기준)`.

## Required Inputs

1. `./docs/specs/baseline/00_brief.md`
2. `./docs/specs/baseline/05_technical-context.md`

## Objective

Convert direction into a tighter operational product spec without reopening already approved scope or ignoring the fixed technical context.

## Workflow

1. Turn goals into 1-3 core user flows.
2. Derive the minimum feature set needed for those flows.
3. Define only the entities needed for v1 decisions.
4. Make business rules explicit, especially permissions and state transitions.
5. Add edge cases that affect validation, UI states, or data integrity.
6. Reflect technical constraints only where they meaningfully change the product shape.
7. Rewrite success criteria so they can be checked later.

## Security Lens

Keep this pass lightweight and product-facing.

- Check whether user flows or business rules introduce auth, permission, ownership, tenant, or destructive-action concerns.
- Check whether features handle sensitive data, uploads, external callbacks, or rendered rich content.
- Record the result under `보안 고려사항`.
- If any of those triggers exist or the boundary is unclear, recommend `spec-security-01-triage` in `mode=spec`.

Use [references/template.md](references/template.md) when drafting the file.

## Glossary Rule

- Check `./docs/specs/baseline/01_glossary.md` if it exists and the product spec introduces or chooses domain terms, entity names, state names, or user-facing labels.
- After writing the target document, `spec-shared-glossary-sync` is recommended because product specs often add or refine canonical vocabulary.

## Required Sections

- `핵심 사용자 플로우`
- `기능`
- `엔티티`
- `비즈니스 규칙`
- `엣지 케이스`
- `성공 기준`
- `기술 제약 반영 메모`
- `보안 고려사항`
- `미해결 결정사항`

## Mermaid Rule

Add Mermaid when the product behavior is easier to understand visually.

- Use flowchart for multi-step user flows.
- Use stateDiagram for non-trivial state transitions.
- Skip Mermaid if there is only one short flow and no meaningful state logic.

## Quality Bar

The product spec is not ready if:

- features do not map cleanly to user flows
- entities exist without behavioral rules
- success criteria cannot be validated later
- technical context is contradicted or ignored
