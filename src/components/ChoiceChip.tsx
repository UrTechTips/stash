import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

/** Single-choice chip for categories and accounts. 48 pt touch target, slimmer look. */
export function ChoiceChip({
  label,
  selected,
  onPress,
  leadingEmoji,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  leadingEmoji?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryContainer : 'transparent',
          borderColor: selected ? colors.primary : colors.outline,
        },
      ]}
    >
      {leadingEmoji ? <Text style={typography.body}>{leadingEmoji}</Text> : null}
      <Text
        numberOfLines={1}
        style={[typography.label, { color: selected ? colors.onPrimaryContainer : colors.textPrimary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
