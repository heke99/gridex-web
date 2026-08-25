# Gridex public web UI audit — 2026-08-25

## Scope

Repository: `heke99/gridex-web`

This audit covers the public Gridex website only. `gridex-ops-platform` is explicitly out of scope.

The audit is intentionally separated from the implementation batch so visual work can be changed without touching pricing, checkout, legal acceptance, customer writes, authentication semantics or OPS.

## Executive finding

The current site is functional and clear enough to use, but its visual grammar strongly matches the common AI-generated SaaS look: dark surfaces, cyan accents, blurred glow orbs, rounded panels, badges and cards nested inside other cards.

The next redesign should not add more effects. It should remove unnecessary decoration, strengthen typography and hierarchy, introduce more open/editorial composition, and use subtle motion only where it improves feedback or continuity.

## Evidence from current code

### 1. Hero is visually over-contained

`app/(public)/page.tsx` currently uses:
- a large `rounded-3xl` bordered dark hero container
- two blurred cyan/blue glow orbs
- a pill badge above the headline
- a glowing cyan CTA
- three small feature cards inside the hero
- another rounded panel on the right
- three more nested feature cards inside that panel

This is the highest-priority source of the "AI landing page" feeling.

### 2. Homepage repeats the same card language

The trust row and "Så fungerar det" continue with repeated bordered dark cards and similar rounded shapes. Repetition reduces hierarchy: everything gets a container, so nothing feels meaningfully primary.

### 3. Calculator looks like another marketing card

`components/ElectricityCalculator.tsx` is wrapped in another large dark rounded panel with a blurred cyan glow. Inside it, fields, status information, selectors and consumption flow repeatedly use rounded bordered sub-panels.

The calculator should feel more like a focused service/form and less like a dashboard widget.

### 4. Price result has too many nested surfaces

`components/PriceResultCard.tsx` currently contains:
- glow decoration
- multiple pill badges
- rounded price panel
- rounded price-basis panel
- rounded fee/specification panel
- rounded notice panels
- rounded assumptions panel
- glowing CTA

The price itself is important, but the current number of competing surfaces weakens it.

### 5. Primary CTA relies on glow

Both the homepage and price result use a cyan CTA with a large glow shadow. The action can remain visually strong through contrast, sizing and placement without a neon effect.

### 6. Typography foundation is inconsistent

`app/globals.css` exposes Geist theme variables but the `body` rule uses `Arial, Helvetica, sans-serif`. The root layout also does not currently establish the Geist font variables.

This should be resolved before tuning individual components, otherwise typography changes will drift.

### 7. Header is visually heavy for a utility service

`components/layout/PublicHeader.tsx` uses black/translucent glass styling, cyan active indicators and a bright cyan CTA. Functionally it is good, but the redesign should make it quieter and give content more visual authority than chrome.

### 8. Footer is structurally good but can become more editorial

`components/layout/Footer.tsx` already has useful legal and company information. It does not need a structural rewrite. The redesign should mainly improve typography, spacing, link grouping and mobile rhythm.

## What should stay

Keep:
- clear company/legal identity
- transparent price specification
- address → area verification
- consumption estimator
- customer type selection
- checkout context handoff
- network-fee notice
- market-settlement notice
- real error messages
- eager Teckna prefetch
- route loading feedback
- accessible labels/fieldsets
- current public information architecture unless a later UX task proves a change is needed

## Target visual direction

### Human utility, not AI SaaS

Use:
- neutral dark/light surfaces with one controlled Gridex accent
- open sections
- stronger type hierarchy
- fewer borders
- fewer pills
- deliberate asymmetry where useful
- large real numbers/data when relevant
- small, functional micro-interactions
- calm Swedish copy

Avoid:
- decorative glow
- gradient orbs
- glassmorphism as a default
- card soup
- repeated 3-column feature grids
- motion for motion's sake
- vague "future of energy" messaging

## Prioritized implementation plan

### P0 — foundation

1. Establish deliberate font loading and typography tokens.
2. Add reusable public spacing/surface/action tokens without creating a giant design-system abstraction.
3. Add reduced-motion baseline.
4. Keep all runtime/business behavior unchanged.

### P1 — homepage

1. Rebuild hero composition with fewer containers.
2. Remove glow orbs and glowing CTA.
3. Collapse/rewrite duplicated trust/feature-card sections.
4. Make the calculator visually central.
5. Preserve SEO text and required content while improving hierarchy.

### P1 — calculator/result

1. Reduce nested rounded panels.
2. Use field groups and whitespace instead of box-per-group.
3. Make selected state clear without cyan background on every selection.
4. Make price the primary result signal.
5. Keep all pricing caveats, assumptions and fees available.
6. Improve async feedback without adding heavy animation libraries.

### P1 — navigation

1. Quiet the header.
2. Preserve all links, auth state and checkout-session notice behavior.
3. Improve mobile menu hierarchy and target sizes.

### P2 — teckna visual continuity

1. Keep the current eager prefetch and loading route.
2. Redesign loading state to match the new visual language.
3. Consider native React/View Transition continuity for the selected contract/result into checkout only if it remains fast and robust.

### P2 — footer and content pages

Polish typography, spacing and content grouping after the primary funnel is consistent.

## Safety boundaries for implementation

Every redesign PR must prove that it did not change:
- public pricing inputs/outputs
- contract selection semantics
- checkout token/context behavior
- legal acceptance
- authentication
- customer writes
- OPS integrations

Prefer class/layout/component changes over business-logic edits.

## Skills to apply

Already present:
- `vercel-react-best-practices`
- `web-design-guidelines`

Added with this audit:
- `vercel-composition-patterns`
- `vercel-react-view-transitions`
- `gridex-design`

External inspiration evaluated but not vendored:
- `aladicf/better-web-ui` — useful critique/hierarchy/forms/motion doctrine, but its current license is custom/MIT-based rather than plain MIT. Gridex keeps its own local doctrine instead of copying that library wholesale.

## First implementation batch after this audit

The first visual code batch should be:
**global typography/tokens + header + homepage hero**

It should not yet rewrite calculator business logic or checkout behavior.
