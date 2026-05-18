---
name: spec-product-01-idea-to-brief
description: Turn a rough new product idea into a Korean 00_brief.md inside the current project's docs/specs/baseline directory, fixing problem, user, value, goals, non-goals, MVP scope, and risks before downstream planning begins.
disable-model-invocation: true
---

# spec-product-01-idea-to-brief

Use this skill when the input is still rough and the next artifact should be `./docs/specs/baseline/00_brief.md` for a new product or major new module.

## Output Location

- Write into the current workspace, not the skill folder.
- Default output path: `./docs/specs/baseline/00_brief.md`

## Language Rules

- Write the document in Korean.
- Keep product names, code-facing names, API field names, library/service names, file paths, and widely used technical terms in their natural English form when that is clearer and more standard.
- Do not force awkward phonetic transliterations such as `소스 오브 트루스`, `타겟 플랫폼`, or `워크 패킷`.
- If an English technical term needs explanation, keep the English term and add a short Korean gloss on first mention, for example `source of truth(가장 신뢰하는 기준)`.

## Glossary Rule

- Check `./docs/specs/baseline/01_glossary.md` only if it exists and the brief introduces product terms, user-facing labels, or domain nouns that may collide with existing terminology.
- After writing the target document, `spec-shared-glossary-sync` is recommended because briefs often introduce new canonical terms.

## Objective

Freeze direction and scope early enough that later stages do not expand the product by accident.

## Security Lens

Run a short security pass without turning the brief into a security review.

- Check whether the idea touches auth, permissions, tenant boundaries, or admin-only behavior.
- Check whether it introduces sensitive data, billing, deletion, uploads, or external callbacks.
- Record the result under `보안 고려사항`.
- If any trigger is present or the risk is unclear, recommend `spec-security-01-triage` in `mode=spec`.

## Workflow

1. Compress the idea into one clear problem statement.
2. Identify the target user as specifically as possible.
3. State the value proposition in one short paragraph.
4. Reduce goals to the smallest set that defines MVP success.
5. Write non-goals aggressively to protect scope.
6. Capture assumptions and risks that could invalidate the brief.

Use [references/template.md](references/template.md) when drafting the file.

## Required Sections

- `문제`
- `대상 사용자`
- `가치 제안`
- `목표`
- `비목표`
- `MVP 범위`
- `리스크 / 가정`
- `보안 고려사항`
- `승인 체크포인트`

## Mermaid Rule

Include a Mermaid diagram only when it materially improves comprehension.

- Use a simple flowchart when the brief has 3 or more distinct user flows or actor handoffs.
- Skip Mermaid if the brief is already obvious from short prose.

## Quality Bar

The brief is not ready if:

- the target user is broad enough to imply multiple products
- goals imply several systems at once
- non-goals are weak or missing
- the MVP scope still contains epic-sized areas without limits
