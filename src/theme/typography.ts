import type { TextStyle } from 'react-native';

/**
 * Two families, clearly different:
 * - Fraunces: a soft serif with real character. Only for headings and the large
 *   amounts, the way figures look on a banknote or a ledger heading.
 * - Manrope: a clean sans for everything you read and tap.
 *
 * On React Native, pick the font by family name and do NOT set fontWeight:
 * each weight is its own font file ("Manrope_700Bold"). These names are
 * registered in app/_layout.tsx with useFonts().
 */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  body: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

/** Equal-width digits, so amounts line up down a column. */
const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

const styles = <T extends Record<string, TextStyle>>(x: T) => x;

/** Colors are applied at the call site. Sentence case everywhere; no all-caps labels. */
export const typography = styles({
  // Money
  hero: { fontFamily: fonts.display, fontSize: 60, lineHeight: 66, letterSpacing: -1.5, fontVariant: tabular },
  entry: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, letterSpacing: -1, fontVariant: tabular },
  amountLarge: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontVariant: tabular },
  amountRow: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, fontVariant: tabular },
  amountSmall: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, fontVariant: tabular },
  keypad: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, fontVariant: tabular },

  // Headings
  headline: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  headlineLarge: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },

  // UI text
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: 0.1 },
  titleSmall: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodyLarge: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelSmall: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
});
