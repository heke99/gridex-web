import { defineMobileBrand } from '../../../packages/mobile-foundation/src/brand.mjs';

/** Gridex-specific public presentation, deliberately outside the portable core. */
export const gridexBrand = defineMobileBrand({
  id: 'gridex',
  displayName: 'Gridex El',
  supportUrl: 'https://gridex.se/kontakt',
  theme: {
    canvas: '#08090b', surface: '#0f1115', text: '#f4f6f7',
    muted: '#a7afb8', accent: '#35c9d7', accentText: '#041113',
  },
});
