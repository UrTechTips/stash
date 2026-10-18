import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

/**
 * An empty screen is an invitation to act: say what goes here and give the one button that fills it.
 * <EmptyState title="No accounts yet" body="Add the places your money lives: bank, UPI, cash."
 *             actionLabel="Add account" onAction={...} />
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[typography.headline, styles.center, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[typography.label, { color: colors.onPrimary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 32, paddingVertical: 48, alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  button: {
    marginTop: 12,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
