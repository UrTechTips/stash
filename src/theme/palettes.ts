import { Palette, defaultDarkPalette, defaultLightPalette, draculaDark, nordDark, nordLight, tokyoNightDark } from './colors';

export const darkPalettes: Record<string, Palette> = {
  'Default': defaultDarkPalette,
  'Tokyo Night': tokyoNightDark,
  'Nord': nordDark,
  'Dracula': draculaDark,
}

export const lightPalettes: Record<string, Palette> = {
  'Default': defaultLightPalette,
  'Nord': nordLight,
}

export const darkThemeNames = [
    { value: 'default', label: 'Default'},
    { value: 'tokyo-night', label: 'Tokyo Night'},
    { value: 'nord', label: 'Nord'},
    { value: 'dracula', label: 'Dracula'},
]
export const lightThemeNames = [
    { value: 'default', label: 'Default'},
    { value: 'nord', label: 'Nord'},
]