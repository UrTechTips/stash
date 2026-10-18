import { useHaptics } from '@/hooks/useHaptics';
import type { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A floating bottom navigation bar: a rounded pill that hovers above the content with a
 * gap around it, instead of a bar docked to the screen edge.
 *
 * The selected tab grows to show its label; the others show just their icon. Every tab keeps
 * a spoken label for screen readers.
 *
 * Use it as the tab bar of Expo Router's <Tabs>:
 *
 *   <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
 *
 * Because the bar floats, screens extend underneath it. Pad the bottom of scrolling content
 * with useFloatingBarSpace() so the last row is not hidden, and lift any floating button by
 * the same amount.
 */

// The props Expo Router hands to a custom tab bar (taken from <Tabs> so the type can't drift).
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const BAR_HEIGHT = 64;
const BAR_GAP = 12; // space between the bar and the bottom edge / system bar
const SIDE_MARGIN = 20;
const ICON_SIZE = 22;

/** Bottom space the bar occupies. Add it to the paddingBottom of scrollable screens. */
export function useFloatingBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + BAR_GAP + insets.bottom;
}

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) return null; // get out of the way while typing

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + BAR_GAP }]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outline,
            shadowColor: colors.isDark ? '#000000' : colors.textPrimary,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
          const focused = state.index === index;
          const tint = focused ? colors.onPrimaryContainer : colors.textSecondary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              onPress={useHaptics(onPress, 'medium')}
              onLongPress={useHaptics(onLongPress, 'light')}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={[
                styles.item,
                focused
                  ? { flex: 2.4, backgroundColor: colors.primaryContainer }
                  : { flex: 1 },
              ]}
            >
              {options.tabBarIcon?.({ focused, color: tint, size: ICON_SIZE })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-width, non-blocking strip; only the bar itself catches touches.
  wrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: SIDE_MARGIN },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    elevation: 6,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    height: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
  },
});
