import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAction } from '../app-state/actions';
import { useApp, useQuery } from '../app-state/AppProvider';
import { Button, Field, FormScreen, OptionChips, TextField } from '../components';
import { createCategory, getCategory, setCategoryArchived, updateCategory } from '../db/categories';
import type { CategoryKind } from '../db/types';
import { useTheme } from '../theme/ThemeProvider';

const COLORS = ['#2F7FD0', '#17A06A', '#E08A1E', '#6C4FD8', '#C03F2B', '#D0457A', '#8A6D3B', '#3BA08A'];

export default function CategoryEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { db } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const { data: category } = useQuery((d) => (id ? getCategory(d, Number(id)) : Promise.resolve(null)), [id]);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('discretionary');
  const [icon, setIcon] = useState('🏷️');
  const [color, setColor] = useState(COLORS[0]);
  const [loaded, setLoaded] = useState(false);

  // Fill the form once when the saved data arrives (setting state while rendering is the supported way to do this).
  if (category && !loaded) {
    setName(category.name);
    setKind(category.kind);
    setIcon(category.icon);
    setColor(category.color);
    setLoaded(true);
  }

  const save = async () => {
    const ok = await run(async () => {
      if (id) await updateCategory(db, Number(id), { name, kind, icon, color });
      else await createCategory(db, { name, kind, icon, color });
      return true;
    });
    if (ok) router.back();
  };

  const toggleArchive = async () => {
    if (!category) return;
    await run(() => setCategoryArchived(db, category.id, !category.archived));
    router.back();
  };

  return (
    <FormScreen
      title={id ? 'Edit category' : 'Add a category'}
      footer={
        <>
          <Button label={id ? 'Save changes' : 'Add category'} onPress={save} disabled={name.trim().length === 0} />
          {category ? <Button label={category.archived ? 'Restore category' : 'Archive category'} kind="secondary" onPress={toggleArchive} /> : null}
        </>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} maxLength={30} />
      <OptionChips
        label="Kind"
        options={[
          { value: 'essential', label: 'Essential' },
          { value: 'discretionary', label: 'Discretionary' },
          { value: 'income', label: 'Income' },
        ] as { value: CategoryKind; label: string }[]}
        value={kind}
        onChange={setKind}
        hint="Essentials set your safety buffer. Discretionary spending feeds the Buy-or-Wait budget check."
      />
      <TextField label="Icon (one emoji)" value={icon} onChangeText={setIcon} maxLength={8} />
      <Field label="Color">
        <View style={styles.swatches}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: color === c }}
              style={[styles.swatch, { backgroundColor: c, borderColor: color === c ? colors.textPrimary : 'transparent' }]}
            />
          ))}
        </View>
      </Field>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
});
