import { useHaptics } from '@/hooks/useHaptics';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { useFloatingBarSpace } from './FloatingTabBar';

/**
 * The one-tap entry point for quick-add. Floats bottom-right above the tab bar.
 * Render it inside a screen's root View (not inside a ScrollView).
 */
export function AddButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const barSpace = useFloatingBarSpace();
  return (
    <Pressable
      onPress={haptics(onPress, 'medium')}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      style={[styles.fab, { bottom: barSpace + 16, backgroundColor: colors.heroAccent }]}
    >
      <Ionicons name="add" size={24} color={colors.onHeroAccent} />
      <Text style={[typography.label, { color: colors.onHeroAccent }]}>Add</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: radius.fab,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
