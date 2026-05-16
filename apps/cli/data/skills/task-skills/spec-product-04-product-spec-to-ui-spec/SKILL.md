---
name: spec-product-04-product-spec-to-ui-spec
description: Generate initial Korean 20_ui-spec.md, optional English 21_stitch-prompt.md, and initial visual guidance from approved product specs, screenshots, or Stitch/reference drafts for first product implementation only.
disable-model-invocation: true
---

# spec-product-04-product-spec-to-ui-spec

Use this skill when `./docs/specs/baseline/10_product-spec.md` is approved and the product needs initial UI direction before first implementation.

Default outputs:

- `./docs/specs/baseline/20_ui-spec.md`
- optional `./docs/specs/baseline/21_stitch-prompt.md`
- optional `./docs/specs/baseline/22_stitch-assets/DESIGN.md`
- optional `./docs/specs/baseline/24_design-tokens.md`

Do not use this skill as the default path for MVP-afterward UI changes. Ongoing UI work belongs in `.codex/plans/*.md` with screenshots, reference apps, and detailed requested adjustments.

## Language Rules

- `20_ui-spec.md`, `DESIGN.md`, and `24_design-tokens.md` must be written in Korean.
- `21_stitch-prompt.md`, when created, must be written in English.
- Keep code-facing names, API field names, library/service names, protocol names, file paths, and standard technical terms in their natural English form when clearer.
- Do not force awkward phonetic transliterations.

## Required Inputs

1. `./docs/specs/baseline/05_technical-context.md`
2. `./docs/specs/baseline/10_product-spec.md`
3. optional user-provided screenshots, reference apps, mood notes, or visual constraints
4. optional Stitch output under `./docs/specs/baseline/22_stitch-assets/`

## Objective

Define initial UI structure and states clearly enough for first implementation, while treating visual references as concept/draft input rather than product truth.

The skill should:

- enumerate screens from approved user flows
- define screen purpose, primary actions, states, and navigation boundaries
- preserve target platform constraints
- normalize initial visual direction against approved product scope
- reject or defer visual ideas that imply unapproved product behavior
- create a Stitch prompt only when external visual generation will reduce ambiguity

## Workflow

1. Read approved product and technical context.
2. Identify UI surfaces that are required for the first build.
3. Draft `20_ui-spec.md` around screens, states, interactions, and design constraints.
4. If the user wants Stitch concepting, write `21_stitch-prompt.md` in English.
5. If screenshots or Stitch output already establish reusable visual rules, write or update baseline `DESIGN.md` and optional tokens.
6. Record security-relevant UI surfaces under `보안 고려사항`.

## Visual Reference Rules

- Stitch, screenshots, and reference apps are inspiration and structure references, not product truth.
- Approved product spec and technical context outrank visual references.
- If a reference introduces unsupported features, labels, business rules, biometric/medical claims, social mechanics, monetization, or platform assumptions, reject or mark them out of scope.
- For Flutter or native apps, translate visual ideas into native primitives and theme/tokens. Do not treat HTML/CSS as the shipping stack.
- Keep initial guidance practical enough for `spec-product-05` to create implementation packets.

## Security Lens

Keep this pass UI-focused and short.

- Check whether the UI introduces auth-sensitive actions, destructive actions, file upload/download, rendered user content, or admin-only surfaces.
- Record the result under `보안 고려사항`.
- If any trigger appears or the trust boundary is unclear, recommend `spec-security-01-triage` in `mode=spec`.

Use these references while drafting:

- [references/ui-spec-template.md](references/ui-spec-template.md)
- [references/stitch-prompt-template.md](references/stitch-prompt-template.md)

## Required UI Spec Sections

- `화면 목록`
- `화면 목적`
- `상태 정의`
- `주요 인터랙션`
- `디자인 제약`
- `초기 시각 참고 / 구현 번역 규칙`
- `보안 고려사항`

## Mermaid Rule

Include Mermaid only when navigation or state coverage is dense.

- Use flowchart for screen-to-screen navigation.
- Use stateDiagram for per-screen states when more than 4 states or transitions matter.
- Skip Mermaid if prose is enough.
