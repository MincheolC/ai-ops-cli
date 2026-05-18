---
name: spec-product-02-brief-to-technical-context
description: Convert an approved Korean 00_brief.md into a Korean 05_technical-context.md inside the current project's docs/specs/baseline directory, selecting preferred stacks first and requiring explicit justification for any extra technology outside those defaults.
disable-model-invocation: true
---

# spec-product-02-brief-to-technical-context

Use this skill after `./docs/specs/baseline/00_brief.md` is approved and before writing the product spec.

## Output Location

- Write into the current workspace.
- Default output path: `./docs/specs/baseline/05_technical-context.md`

## Language Rules

- Write the document in Korean.
- Keep code-facing names, API field names, library/service names, protocol names, file paths, and widely used technical terms in their natural English form when that is clearer and more standard.
- Do not force awkward phonetic transliterations such as `소스 오브 트루스`, `타겟 플랫폼`, or `워크 패킷`.
- If an English technical term needs explanation, keep the English term and add a short Korean gloss on first mention, for example `source of truth(가장 신뢰하는 기준)`.

## Glossary Rule

- Check `./docs/specs/baseline/01_glossary.md` only if it exists and the document introduces stack names, architectural terms, or labels that should align with existing terminology.
- After writing the target document, run `spec-shared-glossary-sync` only if new technical terms, product-facing labels, or collisions were introduced.

## Default Stack Preferences

- Web service:
  - TypeScript
  - Next.js
  - shadcn/ui
  - Tailwind CSS
  - date-fns
  - Supabase
- App service:
  - Flutter
- Backend server:
  - NestJS
  - Prisma
  - Supabase
  - GraphQL
- Simple serverless service:
  - Hono
  - RESTful API

## Decision Rules

- First, decide within the preferred stack range.
- Only recommend technology outside the preferred range when the need is concrete.
- Read the current repository shape when it already exists and record whether each chosen stack surface is already present, partially present, or absent.
- If the repository is empty or missing the chosen surface, record that downstream packet generation must include explicit bootstrap work rather than assuming scaffolded files already exist.
- Any extra technology must include:
  - why the preferred stack is insufficient
  - what benefit the new technology adds
  - what complexity or operating cost increases
  - whether explicit human approval is needed before adopting it

## Security Lens

Keep the security pass short and infrastructure-focused.

- Check whether the chosen stack introduces auth, secret, storage, external callback, upload, or tenant-isolation constraints.
- Record the result under `보안 고려사항`.
- If the architecture or deployment assumptions create unclear trust boundaries, recommend `spec-security-01-triage` in `mode=spec`.

Use [references/template.md](references/template.md) when drafting the file.

## Required Sections

- `제품 형태`
- `기본 선택 스택`
- `선택 근거`
- `운영 / 배포 가정`
- `보안 고려사항`
- `프로젝트 제약`
- `현재 저장소 상태 / 스택 갭`
- `추가 기술 제안 규칙`
- `미해결 기술 결정사항`

## Mermaid Rule

Include Mermaid only when the stack split or deployment shape is non-trivial.

- Use a simple graph when web, app, backend, workers, or third-party services interact.
- Skip Mermaid for a single-surface product with an obvious stack.

## Objective

Lock implementation constraints early enough that downstream specs, UI work, packets, and plans all assume the same stack boundaries, while making stack gaps against the current repository explicit enough that bootstrap packets can be generated later without guesswork.
