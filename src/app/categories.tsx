import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '../app-state/AppProvider';
import { CategoryBadge, Screen, ScreenHeader, SectionHeader } from '../components';
import { listCategories } from '../db/categories';
import type { CategoryKind } from '../db/types';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

const GROUPS: { kind: CategoryKind; title: string; hint: string }[] = [
  { kind: 'essential', title: 'Essentials', hint: 'Needed to live. They set your safety buffer.' },
  { kind: 'discretionary', title: 'Discretionary', hint: 'Nice to have. They feed the Buy-or-Wait budget check.' },
  { kind: 'income', title: 'Income', hint: 'Money coming in.' },
];

export default function Categories() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery((db) => listCategories(db, { includeArchived: true }));
  const edit = (id?: number) => router.push(id ? { pathname: '/category-edit', params: { id: String(id) } } : '/category-edit');

  const add = (
    <Pressable onPress={() => edit()} accessibilityRole="button" accessibilityLabel="Add a category" style={styles.iconButton}>
      <Ionicons name="add-circle" size={32} color={colors.primary} />
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader title="Categories" right={add} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {GROUPS.map((g) => (
          <React.Fragment key={g.kind}>
            <SectionHeader title={g.title} />
            <Text style={[typography.bodySmall, styles.hint, { color: colors.textSecondary }]}>{g.hint}</Text>
            {(data ?? []).filter((c) => c.kind === g.kind).map((c) => (
              <Pressable key={c.id} onPress={() => edit(c.id)} accessibilityRole="button" style={[styles.row, c.archived && { opacity: 0.5 }]}>
                <CategoryBadge emoji={c.icon} tint={c.color} />
                <Text style={[typography.titleSmall, { color: colors.textPrimary, flex: 1 }]}>{c.name}{c.archived ? ' (archived)' : ''}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </React.Fragment>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { paddingHorizontal: 20, marginTop: -6, marginBottom: 6 },
  row: { minHeight: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
