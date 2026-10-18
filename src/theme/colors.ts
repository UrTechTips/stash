/**
 * Design notes
 * - Paper, ink, and one deep "vault" panel. The vault panel is the only heavy
 *   surface in the app and it always holds the one number that matters.
 * - Expenses are NOT red. Red is reserved for "Don't buy" and "over budget".
 *   A screen full of red minus signs trains you to stop looking.
 * - Verdict colors are semantic (buy / hold / save / stop) and always paired
 *   with a text label, so color is never the only signal.
 */
export type Palette = {
  isDark: boolean;

  // Surfaces
  background: string;
  surface: string;
  surfaceRaised: string;
  outline: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;

  // Brand
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  // Hero panel (the "safe to spend" block)
  hero: string;
  onHero: string;
  onHeroMuted: string;
  heroTrack: string;
  heroAccent: string;
  onHeroAccent: string;

  // Money
  income: string;

  // Budget pace marker
  paceMarker: string;

  // Verdicts: accent (icons, edges), container (chip fill), on (text on the chip)
  buy: string;
  buyContainer: string;
  onBuy: string;
  hold: string;
  holdContainer: string;
  onHold: string;
  save: string;
  saveContainer: string;
  onSave: string;
  stop: string;
  stopContainer: string;
  onStop: string;
  /** Red that is safe for small text (darker in light mode, lighter in dark mode). */
  stopText: string;
};


export const lightPalette: Palette = {
  isDark: false,

  // Base surfaces
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceRaised: '#EEF2F6',
  outline: '#DCE4EA',

  // Text
  textPrimary: '#17252E',
  textSecondary: '#667784',
  textDisabled: '#8A98A2',

  // Primary brand: deep teal
  primary: '#117C72',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DDF5F0',
  onPrimaryContainer: '#104A43',

  // Hero / balance card
  hero: '#104A43',
  onHero: '#F4FAF8',
  onHeroMuted: '#B5D4CD',
  heroTrack: '#28665D',
  heroAccent: '#F2BF65',
  onHeroAccent: '#352600',

  // Financial status
  income: '#17865D',
  paceMarker: '#17252E',

  // Buy-or-Wait: BUY
  buy: '#17865D',
  buyContainer: '#DDF3E7',
  onBuy: '#105536',

  // Buy-or-Wait: HOLD
  hold: '#A66B12',
  holdContainer: '#FFF0CC',
  onHold: '#593800',

  // Buy-or-Wait: SAVE
  save: '#4779C4',
  saveContainer: '#E4ECFC',
  onSave: '#234579',

  // Buy-or-Wait: STOP
  stop: '#D95757',
  stopContainer: '#FCE5E3',
  onStop: '#762B2B',
  stopText: '#B83D3D',
};

export const darkPalette: Palette = {
  isDark: true,

  // Base surfaces
  background: '#0D1418',
  surface: '#141E23',
  surfaceRaised: '#1B2A30',
  outline: '#2A3B42',

  // Text
  textPrimary: '#EFF6F6',
  textSecondary: '#A1B2B7',
  textDisabled: '#71838A',

  // Primary brand: mint teal
  primary: '#63D6C3',
  onPrimary: '#092A27',
  primaryContainer: '#1C403D',
  onPrimaryContainer: '#C5F5EB',

  // Hero / balance card
  hero: '#102E2A',
  onHero: '#F1FAF7',
  onHeroMuted: '#A4CBC1',
  heroTrack: '#28564E',
  heroAccent: '#F2BF65',
  onHeroAccent: '#352600',

  // Financial status
  income: '#54D6A0',
  paceMarker: '#EFF6F6',

  // Buy-or-Wait: BUY
  buy: '#54D6A0',
  buyContainer: '#163D30',
  onBuy: '#B8F2D5',

  // Buy-or-Wait: HOLD
  hold: '#F3C46B',
  holdContainer: '#3D3018',
  onHold: '#FFE6AD',

  // Buy-or-Wait: SAVE
  save: '#82AFFF',
  saveContainer: '#1C2E50',
  onSave: '#D0DFFF',

  // Buy-or-Wait: STOP
  stop: '#FF7976',
  stopContainer: '#492321',
  onStop: '#FFD1CB',
  stopText: '#FF9690',
};
