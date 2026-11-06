export type MobileTheme = Readonly<Record<'canvas' | 'surface' | 'text' | 'muted' | 'accent' | 'accentText', string>>;
export type MobileBrand = Readonly<{
  id: string;
  displayName: string;
  supportUrl: string;
  theme: MobileTheme;
}>;
/** Validates and copies public presentation data. Brand id never grants access. */
export function defineMobileBrand(input: MobileBrand): MobileBrand;
