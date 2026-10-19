import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { unlock } from '../platform/lock';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { Button } from './forms';

export function LockGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const [locked, setLocked] = useState(enabled);
  const [appState, setAppState] = useState(AppState.currentState);
  const prompting = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return false;
    prompting.current = true;
    const ok = await unlock();
    prompting.current = false;
    if (ok) setLocked(false);
    return ok;
  }, []);

  // Lock again whenever the app goes to the background.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !locked) return;
    let cancelled = false;
    (async () => {
      if (prompting.current) return;
      prompting.current = true;
      const ok = await unlock();
      prompting.current = false;
      if (ok && !cancelled) setLocked(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, locked]);

  if (!enabled || !locked) return <>{children}</>;
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Text style={[typography.headlineLarge, { color: colors.textPrimary }]}>Stash is locked</Text>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
        Unlock with your fingerprint, face or phone PIN to see your money.
      </Text>
      <Button label="Unlock" onPress={tryUnlock} style={{ alignSelf: 'stretch', marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
});
