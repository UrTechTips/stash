/**
 * Not one radius for everything. Each shape says what the thing is:
 * - hero: cut like a banknote corner (tight top-left, generous top-right).
 * - goal cards: a plain rounded rectangle with a colored left edge.
 * - keys and chips: pills and soft squares you can hit with a thumb.
 * - transaction rows have no shape at all; they are flat lines on the page.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
  /** Screen edge padding. */
  screen: 20,
} as const;

export const radius = {
  badge: 12,
  key: 18,
  goal: 20,
  sheet: 28,
  fab: 20,
  pill: 999,
} as const;

export const heroShape = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  borderBottomRightRadius: 16,
  borderBottomLeftRadius: 16,
} as const;

/** Minimum touch target (Material, Apple and the project doc all say about 44 to 48). */
export const MIN_TOUCH = 48;
