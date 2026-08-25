---
name: gridex-design
description: Gridex public-web design doctrine. Use for every visual, interaction, copy, layout, component, form or motion change on gridex-web. The goal is a human, trustworthy Swedish electricity service rather than generic AI-generated SaaS.
license: Proprietary project guidance; upstream technical skills keep their own licenses.
metadata:
  owner: Gridex
  scope: gridex-web only
  version: "1.0.0"
---

# Gridex Design

## Scope boundary

This skill applies only to the public Gridex website in `gridex-web`.

Never change `gridex-ops-platform` as part of a Gridex public-site UI task unless the user explicitly creates a separate OPS task.

UI work must not alter:
- pricing calculations or pricing semantics
- signed quote/context behavior
- checkout validation
- legal acceptance behavior
- EDIEL or supplier-switch logic
- customer writes
- authentication or authorization semantics

## Product personality

Gridex should feel:
- Swedish
- calm
- contemporary
- transparent
- useful
- confident without being loud
- human rather than machine-generated

The visual reference is an excellent digital utility/service product, not a crypto dashboard, AI landing page or generic SaaS template.

## Anti-AI visual rules

Avoid by default:
- cyan/purple glow as decoration
- blurred gradient orbs behind content
- glowing primary buttons
- every section inside a rounded card
- cards nested inside cards
- rows of three identical feature cards just to fill space
- pill/badge spam
- excessive glassmorphism and backdrop blur
- generic icon + heading + paragraph grids
- perfectly repetitive symmetrical section templates
- decorative gradients that carry no product meaning
- animation on every scroll or hover
- marketing copy such as "framtidens", "revolutionerande", "smartare energi" without concrete proof

One strong surface is better than five weak cards.

## Layout and hierarchy

- Build pages around content hierarchy first, containers second.
- Use open page space and section rhythm instead of borders around everything.
- Let important numbers, headings and actions own visual space.
- Vary composition when the content warrants it; do not repeat the same 3-column grid pattern.
- Keep line lengths readable and text groupings obvious.
- Use subtle dividers and spacing before adding another card background.
- Mobile is a primary layout, not a compressed desktop afterthought.

## Color

- Brand color is an accent and action signal, not a page-wide glow effect.
- Use neutral surfaces for most structure.
- Reserve semantic colors for actual status/warning/success information.
- Primary CTA must have clear contrast without relying on box-shadow glow.
- Avoid multiple competing accent colors in the same viewport.

## Typography

- Establish one deliberate sans-serif stack and use it consistently.
- Do not declare one font token and then override the body with unrelated Arial/Helvetica defaults.
- Headings should be compact, readable and sentence-like rather than ad slogans split for visual effect.
- Use weight and scale before color to create hierarchy.
- Body copy should sound natural in Swedish and avoid technical/internal terminology.

## Swedish UX copy

Prefer:
- concrete language
- short sentences
- what the customer gets or needs to do next
- real units, prices, dates and conditions
- "du" when addressing the customer

Avoid:
- internal OPS terminology
- vague claims
- startup language
- fake urgency
- fake social proof
- fake trust badges

If a statement is legal, pricing-related or operationally material, preserve its meaning exactly unless the task explicitly includes legal/copy review.

## Calculator and price result

The calculator is a core product experience, not a marketing card.

- Make the next action obvious.
- Group fields by the customer's mental model: address, consumption, agreement, result.
- Reduce nested surfaces.
- Keep labels persistent; placeholders are examples, not labels.
- Show progress/state without turning every step into a badge.
- Price is the strongest visual element in the result.
- Fees and assumptions remain discoverable and legible.
- Keep network-fee and market-settlement notices visible and semantically correct.
- Never make a variable/indicative price appear more certain than the underlying data allows.

## Teckna flow

- Preserve immediate navigation feedback and prefetching.
- Maintain continuity from selected offer to checkout.
- Reduce cognitive load: one clear primary action per step.
- Do not hide legal/customer choices to make the UI look cleaner.
- Error states should explain what happened and what the customer can do next.

## Navigation and footer

- Navigation should be quiet and easy to scan.
- Do not over-emphasize every active/hover state.
- The footer may be information-dense but should use typographic grouping rather than decorative boxes.
- Legal/company information must remain easy to find.

## Motion

Use `vercel-react-view-transitions` where appropriate.

- Motion has a job: feedback, continuity or orientation.
- Prefer CSS/native transitions.
- Typical duration: 160–220 ms; larger transitions should usually stay below 300 ms.
- No bouncing or attention-seeking choreography.
- Respect reduced motion.
- Never trade performance for decoration.

## Accessibility

Use `web-design-guidelines` for every meaningful UI batch.

Minimum:
- correct semantic elements
- visible keyboard focus
- adequate target sizes
- WCAG-compliant contrast
- associated labels and descriptions
- useful live-region behavior for async calculation states
- no color-only meaning
- reduced-motion support
- responsive text without clipping

## Performance

Use `vercel-react-best-practices`.

- Avoid new dependencies when CSS/platform features are sufficient.
- Keep client components narrow.
- Do not increase bundle size for trivial animation.
- Avoid unnecessary re-renders in the calculator.
- Preserve prefetching and current fast navigation work.
- Images must have correct sizing/loading behavior.
- Visual polish must not worsen Core Web Vitals.

## Working method

Before a visual change:
1. Identify the customer problem and current hierarchy problem.
2. Check this doctrine plus the relevant technical skills.
3. Separate visual-only work from business/checkout logic.
4. Implement one coherent surface or flow at a time.
5. Verify desktop and mobile.
6. Run accessibility, React/performance and regression checks.
7. Reject any result that is merely "more polished" but still looks like a generic AI/SaaS template.

## Current redesign direction

The initial public-site modernization should proceed in this order:

1. Global typography, spacing and surface tokens.
2. Header/navigation.
3. Homepage hero.
4. Calculator shell and field hierarchy.
5. Price result presentation and CTA.
6. Supporting homepage sections.
7. Teckna visual continuity and loading states.
8. Footer polish.
9. Mobile/reduced-motion/accessibility pass.

Do not redesign OPS.
