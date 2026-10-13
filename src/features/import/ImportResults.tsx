import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Palette } from '@/constants/theme';
import {
    COLOR_HEX, COLOR_ORDER, TYPE_LABELS, TYPE_ORDER, normalize, type FoundItem,
} from './importUtils';

type Row = FoundItem & { selected: boolean };

interface Props {
  items: FoundItem[];
  onBack: () => void;
  onConfirm: (selected: FoundItem[]) => void;
}

export default function ImportResults({ items, onBack, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>(() => items.map((i) => ({ ...i, selected: false })));
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? rows.filter((r) => normalize(r.name).includes(q)) : rows;
  }, [rows, query]);

  const selectedCount = rows.filter((r) => r.selected).length;
  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggleAll = () => {
    const ids = new Set(visible.map((r) => r.id));
    const allOn = visible.every((r) => r.selected);
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, selected: !allOn } : r)));
  };

  const cycle = <T,>(list: T[], current: T) => list[(list.indexOf(current) + 1) % list.length];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={Palette.text} />
        </Pressable>
        <Text style={styles.title}>Tes articles ({rows.length})</Text>
        <Pressable onPress={toggleAll} hitSlop={12}>
          <Text style={styles.link}>Tout cocher</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Coche les vêtements à ajouter. Touche le type ou la couleur d'un article pour les corriger.
      </Text>

      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={20} color={Palette.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Rechercher un article"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>Aucun article ne correspond.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, item.selected && styles.rowActive]}>
            <Pressable onPress={() => update(item.id, { selected: !item.selected })} hitSlop={8}>
              <MaterialCommunityIcons
                name={item.selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={26}
                color={item.selected ? Palette.accent : Palette.textSecondary}
              />
            </Pressable>
            <Image source={{ uri: item.image }} style={styles.img} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <View style={styles.pills}>
                <Pressable style={styles.pill} onPress={() => update(item.id, { type: cycle(TYPE_ORDER, item.type) })}>
                  <Text style={styles.pillText}>{TYPE_LABELS[item.type]}</Text>
                </Pressable>
                <Pressable style={styles.pill} onPress={() => update(item.id, { color: cycle(COLOR_ORDER, item.color) })}>
                  <View style={[styles.dot, { backgroundColor: COLOR_HEX[item.color] }]} />
                  <Text style={styles.pillText}>{item.color}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.primary, selectedCount === 0 && styles.primaryDisabled]}
          disabled={selectedCount === 0}
          onPress={() => onConfirm(rows.filter((r) => r.selected))}
        >
          <Text style={styles.primaryText}>Importer {selectedCount > 0 ? `(${selectedCount})` : ''}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Palette.text },
  link: { color: Palette.accent, fontWeight: '600' },
  hint: { color: Palette.textSecondary, paddingHorizontal: 16, marginBottom: 8, fontSize: 13 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Palette.surfaceRaised, borderColor: Palette.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: Palette.text },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  empty: { color: Palette.textSecondary, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8,
    borderRadius: 14, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border,
  },
  rowActive: { borderColor: Palette.accent, backgroundColor: Palette.accentSoft },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: Palette.surfaceRaised },
  info: { flex: 1, gap: 6 },
  name: { fontSize: 14, color: Palette.text },
  pills: { flexDirection: 'row', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surfaceRaised,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Palette.border,
  },
  pillText: { fontSize: 12, textTransform: 'capitalize', color: Palette.textSecondary },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: Palette.hairline },
  footer: { padding: 16 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: Palette.surfaceSelected, opacity: 0.55 },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
});
