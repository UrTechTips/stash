import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './colors';

type Scheme = 'light' | 'dark' | 'system';

type Theme = { colors: Palette; isDark: boolean };

const ThemeContext = createContext<Theme>({ colors: lightPalette, isDark: false });

/**
 * Wrap the app in this once (see app/_layout.tsx).
 * Follows the phone's light/dark setting unless you pass scheme="light" or "dark".
 */
export function ThemeProvider({
  scheme = 'system',
  children,
}: {
  scheme?: Scheme;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const isDark = scheme === 'system' ? system === 'dark' : scheme === 'dark';
  const value = useMemo<Theme>(
    () => ({ colors: isDark ? darkPalette : lightPalette, isDark }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** const { colors, isDark } = useTheme(); */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
