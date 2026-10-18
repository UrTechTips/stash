import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { QuickAddHost } from '../../components/QuickAddHost';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The five main destinations. Insights and Settings live behind icons on the Home screen,
 * so the bar stays at five or fewer.
 */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'activity', title: 'Activity', icon: 'swap-vertical' },
  { name: 'budget', title: 'Budget', icon: 'pie-chart' },
  { name: 'goals', title: 'Goals', icon: 'flag' },
  { name: 'accounts', title: 'Accounts', icon: 'wallet' },
];

export default function TabsLayout() {
  return (
    <>
      <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
        {TABS.map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
      <QuickAddHost />
    </>
  );
}
