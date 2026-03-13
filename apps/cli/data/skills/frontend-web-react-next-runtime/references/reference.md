# Frontend Web React Next Runtime

## React TypeScript Constraints

- Do not use `React.FC` or `FC`.

## React TypeScript Guidelines

- Use readonly object and array props.

## Next.js Constraints

- Do not import server-only code into client components.
- Do not expose secrets through `NEXT_PUBLIC_` variables.
- Do not use `next/router` in App Router projects.

## Next.js Guidelines

- Follow App Router file conventions.
- Keep server actions in dedicated files.
- Use `next/image` with explicit sizing.
- Use `next/font` in the root layout.
- Use `middleware.ts` only for cross-cutting concerns.
- Export metadata for public pages.
- Add JSON-LD when SEO or GEO matters.

## Web Frontend Library Constraints

- Do not use moment.js or dayjs.
- Do not use react-icons.
- Do not use axios in browser code.
- Do not build conditional className strings manually.
- Do not install parallel UI kits next to shadcn/ui.
- Do not use Redux, Recoil, or MobX for local UI state.

## Web Frontend Library Guidelines

- Keep styling on Tailwind and design tokens.
- Use next-intl for i18n and next-themes for theme switching.
- Render Recharts only inside client components.
- Mount one Sonner toaster at the app root.
- Sanitize user HTML before `dangerouslySetInnerHTML`.
- Use Vitest and Testing Library.

## Decision Rules

- When a component needs browser APIs, hooks, or handlers, add `use client` at the smallest leaf.
- When page data is needed for first render, fetch in server components.
- When internal form mutation is needed, use server actions.
- When form validation is needed, use zod with react-hook-form.
- When client UI state is needed, use a zustand slice.
