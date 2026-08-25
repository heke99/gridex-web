---
name: vercel-react-view-transitions
description: Project-installed guidance based on Vercel's React View Transition skill. Use for purposeful route, loading, shared-element, and state transitions on the public Gridex website.
license: MIT
metadata:
  author: vercel
  source: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions
  installed_for: gridex-web
---

# React View Transitions for Gridex Web

Motion must communicate feedback, continuity or orientation. If it has no job, remove it.

## Priority order

1. Shared-element continuity where the same customer choice moves into a deeper step.
2. Suspense/loading reveal where content genuinely arrives later.
3. State transitions in calculators, selectors and result panels.
4. Route transitions only when they improve orientation.

## Gridex rules

- Prefer native/CSS transitions over adding a heavy animation dependency.
- Keep routine interaction motion short: normally 160–220 ms.
- Use transform and opacity; avoid animating layout-heavy properties when possible.
- No bounce, elastic easing, floating blobs, perpetual motion or decorative parallax.
- Never delay navigation, pricing, form submission or checkout for an animation.
- Preserve the existing eager prefetch path for `Teckna elavtal`.
- Respect `prefers-reduced-motion` and provide a non-motion fallback.
- Keep legal notices, prices and fees stable and readable; do not animate them in a way that obscures or delays comprehension.
- Use shared transitions sparingly for meaningful continuity, for example a selected contract/result moving into the teckna flow.
- Unsupported browsers must degrade cleanly.

## Verification

For every motion change verify:
- keyboard interaction remains correct
- reduced motion is respected
- no layout shift is introduced
- loading feedback appears immediately
- interaction remains responsive on mobile
- the animation can be interrupted by new user intent

Use the upstream Vercel source in metadata for the complete implementation patterns and current Next.js guidance.
