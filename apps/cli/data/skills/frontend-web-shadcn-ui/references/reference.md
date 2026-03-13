# Frontend Web shadcn/ui

## Constraints

- Do not reimplement components already available in shadcn/ui.
- Do not edit generated shadcn source files directly.
- Do not overuse arbitrary Tailwind values for stable design tokens.
- Do not use inline style props for static values.

## Guidelines

- Check the shadcn component catalog before building custom primitives.
- Use `cn()` for conditional class composition.
- Use shadcn composition patterns for complex components.
- Use `cva` for variant-heavy components.
- Keep theme tokens CSS-variable based.
- Use mobile-first responsive classes.
- Preserve accessibility for icon-only controls.
- Use named lucide-react icon imports only.

## Decision Rules

- When a needed UI element already exists in shadcn or Radix composition, use that composition first.
- When no suitable primitive exists and interaction is domain-specific, build a custom component.
- When a component has variants, model them with `cva`.
- When styling is needed, use Tailwind utilities by default.
