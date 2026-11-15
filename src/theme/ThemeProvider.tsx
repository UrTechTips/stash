import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { defaultLightPalette, type Palette } from './colors';
import { darkPalettes, lightPalettes } from './palettes';

type Scheme = "light" | "dark" | "system";
type PaletteName = "default" | "dracula" | "nord" | "tokyo-night";

type Theme = { colors: Palette; isDark: boolean };

const ThemeContext = createContext<Theme>({ colors: defaultLightPalette, isDark: false });

const DARK_PALETTES = Object.fromEntries(
  Object.entries(darkPalettes).map(([k, v]) => [k.toLowerCase().replaceAll(' ', '-'), v])
);;
const LIGHT_PALETTES = Object.fromEntries(
  Object.entries(lightPalettes).map(([k, v]) => [k.toLowerCase().replaceAll(' ', '-'), v])
);

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
    () => ({ colors: isDark ? DARK_PALETTES[palette] : LIGHT_PALETTES[palette], isDark }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** const { colors, isDark } = useTheme(); */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
