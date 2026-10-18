import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { LockGate } from '../components/LockGate';
import { loadSettings } from '../db/settings';
import { AppProvider, useQuery } from '../app-state/AppProvider';
import { useReminderSync } from '../app-state/useReminderSync';
import { setupNotifications } from '../platform/notifications';
import { needsOnboarding } from '../services/bootstrap';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

// Keep the splash screen up until the fonts and the database are ready.
SplashScreen.preventAutoHideAsync();
setupNotifications();

export default function RootLayout() {
  // The names here must match src/theme/typography.ts.
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AppProvider>
        <ThemedApp />
      </AppProvider>
    </ThemeProvider>
  );
}

/** Applies the theme the user picked in Settings and the app lock. */
function ThemedApp() {
  const { data: settings } = useQuery((db) => loadSettings(db));
  if (!settings) return null;
  return (
    <ThemeProvider scheme={settings.theme}>
      <LockGate enabled={settings.appLock}>
        <Shell />
      </LockGate>
    </ThemeProvider>
  );
}

function Shell() {
  const { colors, isDark } = useTheme();
  const { data: needsSetup } = useQuery((db) => needsOnboarding(db));
  useReminderSync();
  if (needsSetup === undefined) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={needsSetup}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!needsSetup}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction/[id]" />
          <Stack.Screen name="account/[id]" />
          <Stack.Screen name="goal/[id]" />
          <Stack.Screen name="goal/edit" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="recurring" />
          <Stack.Screen name="recurring-edit" />
          <Stack.Screen name="categories" />
          <Stack.Screen name="category-edit" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
