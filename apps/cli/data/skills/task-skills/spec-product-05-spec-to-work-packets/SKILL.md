---
name: spec-product-05-spec-to-work-packets
description: Convert approved baseline product specs into initial-build Korean work packets under docs/specs/initial-build, with explicit scope, tests, dependencies, and repo-reality bootstrap/foundation packets when needed.
disable-model-invocation: true
---

# spec-product-05-spec-to-work-packets

Use this skill only when the next artifact is the first implementation packet set for a product baseline.

## Output Location

- Write into the current workspace.
- Create or continue one initial-build batch such as `./docs/specs/initial-build/2026-03-21_initial-build/`.
- If no active initial-build batch exists yet, create `./docs/specs/initial-build/YYYY-MM-DD_initial-build/`.
- Default output path: `./docs/specs/initial-build/<initial-build-topic>/30_work-packets/*.md`
- Optional summary artifact: `./docs/specs/initial-build/<initial-build-topic>/30_work-packets/00_packet-map.md`

Do not use this skill as the default path for MVP 이후 changes. Ongoing changes belong in `.codex/plans/*.md`.

## Required Inputs

Read all relevant available inputs before writing packets:

1. `./docs/specs/baseline/05_technical-context.md`
2. `./docs/specs/baseline/10_product-spec.md`
3. `./docs/specs/baseline/20_ui-spec.md` when the product includes approved UI surfaces
4. optional initial visual references under `./docs/specs/baseline/22_stitch-assets/`
5. optional `./docs/specs/baseline/22_stitch-assets/DESIGN.md`
6. optional `./docs/specs/baseline/24_design-tokens.md`
7. current repository manifests, config files, and top-level app/package directories relevant to the approved stack

Use what exists. Explicitly note missing but relevant inputs.

If the product has no user-facing UI by design, proceed from `05_technical-context.md` and `10_product-spec.md` without inventing UI docs or visual inputs.

If the product has UI but no visual references exist, proceed from `20_ui-spec.md`; visual references are helpful but never a blocker.

## Language Rules

- Write every work packet in Korean.
- Keep code identifiers, API field names, library/service names, protocol names, file paths, and standard technical terms in their natural English form when clearer.
- Do not force awkward phonetic transliterations.

## Objective

Produce initial-build packets that are independently understandable, independently implementable, and small enough for human review and safe AI execution.

For initial-build work, packet generation must stay grounded in the current repository reality, not an imagined clean scaffold.

The packet set should be `parallel-ready`:

- packets are small enough to hand to one worker at a time
- dependencies are explicit enough that plan mode can order or parallelize them
- hidden coupling is minimized before execution begins

## Required Sections

Every packet must include:

- `목표`
- `범위`
- `입력물`
- `산출물`
- `대상 파일 / 모듈`
- `승인 기준`
- `보안 검토`
- `테스트`
- `의존성`
- `범위 제외`

For UI-touching packets:

- `입력물` should include `20_ui-spec.md` and any relevant visual guidance that exists
- `승인 기준` must state which UI structure, hierarchy, states, and interactions must survive in the approved target platform
- any intentional deviation from initial visual references must be named explicitly

## Security Overlay

Every packet must include `보안 검토`.

- `보안 검토` must state `판정: 필요 | 불필요 | 확인 필요`.
- It must briefly list trigger surfaces and say whether implementation-stage security review is required.
- If the packet touches auth, permission, sensitive data, tenant boundaries, external fetch, uploads, raw queries, rendered content, or destructive actions, do not mark it `불필요` unless the packet is clearly documentation-only.
- If risk is unclear, use `확인 필요` and recommend `spec-security-01-triage` in `mode=spec`.

## Dependency Rules

Every packet must make dependency state explicit.

- If there is no dependency, write `없음`.
- If another packet must finish first, name the packet ID explicitly.
- If the packet is blocked by a contract, schema, design decision, or external approval, name that dependency explicitly.
- If the packet is likely parallel-safe with other packets, note that inside `의존성`.
- Never leave dependencies implied or blank.

Use a compact structure such as:

- `선행 패킷: 없음`
- `선행 패킷: 001_api-shell`
- `외부 결정 / 선행 계약: Supabase auth schema 확정`
- `병렬 가능 후보: 003_home-shell, 004_session-card`

## Repository Reality Check

Before drafting packets, inspect the current repository for concrete evidence of the approved stack.

- Check stack signals such as `package.json`, lockfiles, workspace manifests, `next.config.*`, `components.json`, `tailwind.config.*`, `pubspec.yaml`, `lib/`, `android/`, `ios/`, `nest-cli.json`, `src/main.ts`, `prisma/schema.prisma`, GraphQL schema/config files, and existing app/package directories.
- Use product surfaces declared in `05_technical-context.md` to decide which signals matter.
- Classify each approved surface as `present`, `partial`, or `absent`.
- If any approved surface is `partial` or `absent`, create explicit bootstrap/foundation packets before feature packets for that surface.

## Bootstrap / Foundation Rules

Bootstrap work is first-class packet work.

- Prefer clear packet names such as `000_repo-bootstrap`, `001_web-foundation`, `002_backend-foundation`, or `003_db-foundation`.
- Cover the minimum setup required to make later feature packets realistic:
  - package manager / workspace initialization when missing
  - framework scaffold or base module wiring
  - required approved dependencies installation
  - baseline config files and directory structure
  - environment/example config wiring needed for local execution
  - smoke-level verification such as install success, boot success, or schema generation success
- Downstream feature packets must list relevant foundation packet IDs in `선행 패킷`.
- Do not scatter the same installation or scaffold work across multiple feature packets.

Use these references while drafting:

- [references/work-packet-template.md](references/work-packet-template.md)
- [references/stitch-html-review.md](references/stitch-html-review.md) only when initial Stitch HTML exists and materially helps UI packet boundaries

## Glossary Rule

- Check `./docs/specs/baseline/01_glossary.md` only if packet wording could drift from established entity, state, or UI terminology.
- Do not run `spec-shared-glossary-sync` by default after packet generation. Run it only if packeting surfaced meaningful new terms or clear terminology collisions.

## Mermaid Rule

Include Mermaid only when dependency structure is hard to scan in prose.

- If packet count is 4 or more, or dependency order across backend/mobile/domain seams is hard to scan, prefer adding `00_packet-map.md`.
- Use graph TD for packet dependency DAGs.
- Skip Mermaid if packets are already linear and obvious.

If `00_packet-map.md` is created, packet files' `## 의존성` sections remain the canonical dependency source.

## Quality Bar

The packet set is not ready if:

- it assumes a framework scaffold that is absent from the repo
- dependencies are implied rather than explicit
- bootstrap work is hidden inside feature packets
- security trigger surfaces are not marked
- UI packets ignore approved UI spec or current visual guidance
- packets are too broad for one worker to implement safely
