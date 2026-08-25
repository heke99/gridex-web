---
name: vercel-composition-patterns
description: Project-installed guidance based on Vercel's React composition patterns. Use when refactoring public Gridex React components, extracting reusable UI, or avoiding boolean-prop and wrapper proliferation.
license: MIT
metadata:
  author: vercel
  source: https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns
  installed_for: gridex-web
---

# React Composition Patterns for Gridex Web

Use this skill together with `vercel-react-best-practices`, `web-design-guidelines`, and `gridex-design`.

## Rules

1. Prefer composition over adding more boolean props.
2. Extract repeated visual structures only when they represent a real product pattern.
3. Avoid generic wrapper components that only hide Tailwind classes without improving semantics.
4. For complex controls, keep state ownership explicit and expose a small, stable interface.
5. Prefer explicit variants over combinatorial prop flags.
6. Keep public-page Server Components server-side by default; introduce client boundaries only where interaction requires them.
7. Do not turn every homepage section into the same Card component. Reuse behavior and tokens, not repetitive visual sameness.
8. Preserve semantic HTML while refactoring: headings, sections, fieldsets, labels, lists, buttons and links must remain meaningful.

## Gridex-specific application

Apply this skill when redesigning:
- hero and navigation
- electricity calculator and result presentation
- contract comparison
- checkout/teckna flow
- footer and public information surfaces

Do not apply it to `gridex-ops-platform`; this project skill is public-web only.

For the full upstream examples and rule catalog, consult the Vercel source linked in metadata.
