import { Palette, defaultDarkPalette, defaultLightPalette, draculaDark, nordDark, nordLight, tokyoNightDark, webSlingerDark, webSlingerLight } from './colors';

export const darkPalettes: Record<string, Palette> = {
  'Default': defaultDarkPalette,
  'Tokyo Night': tokyoNightDark,
  'Nord': nordDark,
  'Dracula': draculaDark,
  'Web Slinger': webSlingerDark,
}

export const lightPalettes: Record<string, Palette> = {
  'Default': defaultLightPalette,
  'Nord': nordLight,
  'Web Slinger': webSlingerLight,
}

export const darkThemeNames = Object.keys(darkPalettes).map((e) => ({value: e.toLowerCase().replace(' ', '-'), label: e}));
export const lightThemeNames = Object.keys(lightPalettes).map((e) => ({value: e.toLowerCase().replace(' ', '-'), label: e}));