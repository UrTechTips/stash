import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '../../app-state/AppProvider';
import { EmptyState, GoalCard, Screen, SectionHeader, useFloatingBarSpace } from '../../components';
import { listGoals } from '../../db/goals';
import { shortDate } from '../../engine/dates';
import { formatMoney } from '../../lib/money';
import { loadContext } from '../../services/context';
import { evaluateAll } from '../../services/goals';
import { headlineFor } from '../../services/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export default function Goals() {
  const router = useRouter();
  const { colors } = useTheme();
  const space = useFloatingBarSpace();
  const { data } = useQuery(async (db, today) => {
    const ctx = await loadContext(db, today);
    const [bought, dropped] = await Promise.all([listGoals(db, 'bought'), listGoals(db, 'dropped')]);
    return { ctx, active: evaluateAll(ctx), bought, dropped };
  });
  if (!data) return <Screen><View /></Screen>;
  const open = (id: number) => router.push({ pathname: '/goal/[id]', params: { id: String(id) } });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space + 80 }}>
        <View style={styles.top}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>Wishlist</Text>
          <Pressable onPress={() => router.push('/goal/edit')} accessibilityRole="button" accessibilityLabel="Add a goal" style={styles.add}>
            <Ionicons name="add-circle" size={32} color={colors.primary} />
          </Pressable>
        </View>

        {data.active.length === 0 ? (
          <EmptyState
            title="Nothing on your wishlist"
            body="Add something you want to buy. Stash checks it against your safety buffer, bills and budget, and tells you when it is safe."
            actionLabel="Add a goal"
            onAction={() => router.push('/goal/edit')}
          />
        ) : (
          <View style={styles.list}>
            {data.active.map(({ goal, verdict }) => (
              <GoalCard
                key={goal.id}
                name={goal.name}
                emoji={goal.type === 'gift' ? '🎁' : goal.type === 'need' ? '🧰' : '🎯'}
                priceMinor={goal.price}
                savedMinor={goal.saved}
                status={verdict.status}
                headline={headlineFor(verdict, data.ctx.today)}
                onPress={() => open(goal.id)}
              />
            ))}
          </View>
        )}

        {data.bought.length > 0 ? (
          <>
            <SectionHeader title="Bought" />
            {data.bought.map((g) => (
              <Pressable key={g.id} onPress={() => open(g.id)} style={styles.doneRow} accessibilityRole="button">
                <Text style={[typography.titleSmall, { color: colors.textPrimary, flex: 1 }]}>{g.name}</Text>
                <Text style={[typography.amountSmall, { color: colors.textSecondary }]}>{formatMoney(g.price)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
        {data.dropped.length > 0 ? (
          <>
            <SectionHeader title="Stopped saving" />
            {data.dropped.map((g) => (
              <Pressable key={g.id} onPress={() => open(g.id)} style={styles.doneRow} accessibilityRole="button">
                <Text style={[typography.titleSmall, { color: colors.textSecondary, flex: 1 }]}>{g.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{shortDate(g.createdAt, data.ctx.today)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 12, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, gap: 12 },
  doneRow: { minHeight: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
