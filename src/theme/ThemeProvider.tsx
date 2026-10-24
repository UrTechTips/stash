import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { defaultDarkPalette, defaultLightPalette, draculaDark, draculaLight, nordDark, nordLight, tokyoNightDark, tokyoNightLight, type Palette } from './colors';

type Scheme = "light" | "dark" | "system";
type PaletteName = "default" | "dracula" | "nord" | "tokyo-night";

type Theme = { colors: Palette; isDark: boolean };

const ThemeContext = createContext<Theme>({ colors: defaultLightPalette, isDark: false });

const VALID_PALETTES: Record<PaletteName, Record<'dark' | 'light', Palette>> = {
  default: { dark: defaultDarkPalette, light: defaultLightPalette },
  dracula: { dark: draculaDark, light: draculaLight },
  nord: { dark: nordDark, light: nordLight },
  'tokyo-night': { dark: tokyoNightDark, light: tokyoNightLight },
}

export function ThemeProvider({
  scheme = 'system',
  palette = 'default',
  children,
}: {
  scheme?: Scheme;
  palette?: PaletteName;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const isDark = scheme === 'system' ? system === 'dark' : scheme === 'dark';
  const value = useMemo<Theme>(
    () => ({ colors: isDark ? VALID_PALETTES[palette].dark : VALID_PALETTES[palette].light, isDark }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** const { colors, isDark } = useTheme(); */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
