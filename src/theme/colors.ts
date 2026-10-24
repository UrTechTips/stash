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


export const defaultLightPalette: Palette = {
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

export const defaultDarkPalette: Palette = {
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

export const tokyoNightLight: Palette = {
  isDark: false,
  background: '#E1E2E7',
  surface: '#F4F4F8',
  surfaceRaised: '#D6D9E3',
  outline: '#C3C8D7',

  textPrimary: '#343B59',
  textSecondary: '#565F89',
  textDisabled: '#7A809C',

  primary: '#34548A',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D5DDF5',
  onPrimaryContainer: '#26385F',

  hero: '#24283B',
  onHero: '#C0CAF5',
  onHeroMuted: '#A9B1D6',
  heroTrack: '#414868',
  heroAccent: '#E0AF68',
  onHeroAccent: '#24202A',

  income: '#587539',
  paceMarker: '#343B59',

  buy: '#587539',
  buyContainer: '#DDE8CE',
  onBuy: '#344B22',

  hold: '#965027',
  holdContainer: '#F5E3C8',
  onHold: '#603719',

  save: '#34548A',
  saveContainer: '#D5DDF5',
  onSave: '#26385F',

  stop: '#8C4351',
  stopContainer: '#F4DCE2',
  onStop: '#642C3B',
  stopText: '#8C354A',
};

export const tokyoNightDark: Palette = {
  isDark: true,
  background: '#1A1B26',
  surface: '#1F2335',
  surfaceRaised: '#292E42',
  outline: '#343B59',

  textPrimary: '#C0CAF5',
  textSecondary: '#A9B1D6',
  textDisabled: '#707AAB',

  primary: '#7AA2F7',
  onPrimary: '#1A1B26',
  primaryContainer: '#343B59',
  onPrimaryContainer: '#C0CAF5',

  hero: '#24283B',
  onHero: '#C0CAF5',
  onHeroMuted: '#A9B1D6',
  heroTrack: '#414868',
  heroAccent: '#E0AF68',
  onHeroAccent: '#24202A',

  income: '#9ECE6A',
  paceMarker: '#C0CAF5',

  buy: '#9ECE6A',
  buyContainer: '#283A30',
  onBuy: '#B9E89A',

  hold: '#E0AF68',
  holdContainer: '#3D3429',
  onHold: '#F0D6A7',

  save: '#7AA2F7',
  saveContainer: '#293653',
  onSave: '#C0D0FF',

  stop: '#F7768E',
  stopContainer: '#442832',
  onStop: '#FFC4CF',
  stopText: '#FF9EAF',
};


export const nordLight: Palette = {
  isDark: false,
  background: '#ECEFF4',
  surface: '#FFFFFF',
  surfaceRaised: '#E5E9F0',
  outline: '#D8DEE9',

  textPrimary: '#2E3440',
  textSecondary: '#4C566A',
  textDisabled: '#7B8495',

  primary: '#5E81AC',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D8E3F0',
  onPrimaryContainer: '#2E4C70',

  hero: '#3B4252',
  onHero: '#ECEFF4',
  onHeroMuted: '#D8DEE9',
  heroTrack: '#4C566A',
  heroAccent: '#EBCB8B',
  onHeroAccent: '#3B3020',

  income: '#4F7A65',
  paceMarker: '#2E3440',

  buy: '#4F7A65',
  buyContainer: '#DCE9DF',
  onBuy: '#2D503C',

  hold: '#B77939',
  holdContainer: '#F4E5D0',
  onHold: '#69441F',

  save: '#5E81AC',
  saveContainer: '#D8E3F0',
  onSave: '#2E4C70',

  stop: '#BF616A',
  stopContainer: '#F5DEE0',
  onStop: '#762F38',
  stopText: '#A33D48',
};

export const nordDark: Palette = {
  isDark: true,
  background: '#2E3440',
  surface: '#353C4A',
  surfaceRaised: '#3B4252',
  outline: '#4C566A',

  textPrimary: '#ECEFF4',
  textSecondary: '#D8DEE9',
  textDisabled: '#8993A4',

  primary: '#88C0D0',
  onPrimary: '#26343A',
  primaryContainer: '#435766',
  onPrimaryContainer: '#D8F0F5',

  hero: '#3B4252',
  onHero: '#ECEFF4',
  onHeroMuted: '#D8DEE9',
  heroTrack: '#4C566A',
  heroAccent: '#EBCB8B',
  onHeroAccent: '#3B3020',

  income: '#A3BE8C',
  paceMarker: '#ECEFF4',

  buy: '#A3BE8C',
  buyContainer: '#3C5145',
  onBuy: '#D7E9C8',

  hold: '#EBCB8B',
  holdContainer: '#514733',
  onHold: '#F8E4B6',

  save: '#88C0D0',
  saveContainer: '#3B505E',
  onSave: '#D8F0F5',

  stop: '#BF616A',
  stopContainer: '#59383F',
  onStop: '#F5D4D7',
  stopText: '#E6A0A6',
};


export const draculaLight: Palette = {
  isDark: false,
  background: '#F8F8F2',
  surface: '#FFFFFF',
  surfaceRaised: '#EFEEE8',
  outline: '#DEDDD6',

  textPrimary: '#282A36',
  textSecondary: '#596273',
  textDisabled: '#858A98',

  primary: '#7656A8',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E9E0F8',
  onPrimaryContainer: '#422B68',

  hero: '#343746',
  onHero: '#F8F8F2',
  onHeroMuted: '#C5C7D4',
  heroTrack: '#484A5A',
  heroAccent: '#FFB86C',
  onHeroAccent: '#422B12',

  income: '#287A52',
  paceMarker: '#282A36',

  buy: '#287A52',
  buyContainer: '#D8F0E1',
  onBuy: '#164D32',

  hold: '#A76717',
  holdContainer: '#FBE8CC',
  onHold: '#633B0B',

  save: '#7656A8',
  saveContainer: '#E9E0F8',
  onSave: '#422B68',

  stop: '#C43C59',
  stopContainer: '#F9DDE4',
  onStop: '#721D32',
  stopText: '#A92D49',
};

export const draculaDark: Palette = {
  isDark: true,
  background: '#282A36',
  surface: '#2D303D',
  surfaceRaised: '#343746',
  outline: '#44475A',

  textPrimary: '#F8F8F2',
  textSecondary: '#C5C7D4',
  textDisabled: '#85889B',

  primary: '#BD93F9',
  onPrimary: '#282038',
  primaryContainer: '#493A63',
  onPrimaryContainer: '#E9D8FF',

  hero: '#20222D',
  onHero: '#F8F8F2',
  onHeroMuted: '#C5C7D4',
  heroTrack: '#44475A',
  heroAccent: '#FFB86C',
  onHeroAccent: '#422B12',

  income: '#50FA7B',
  paceMarker: '#F8F8F2',

  buy: '#50FA7B',
  buyContainer: '#244733',
  onBuy: '#BFFFCB',

  hold: '#FFB86C',
  holdContainer: '#4A3928',
  onHold: '#FFE0B7',

  save: '#BD93F9',
  saveContainer: '#403454',
  onSave: '#E9D8FF',

  stop: '#FF5555',
  stopContainer: '#512D38',
  onStop: '#FFD7DC',
  stopText: '#FF8585',
};
