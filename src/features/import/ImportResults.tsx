import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { Palette } from '@/constants/theme';
import { analyzeProduct, type ProductVerdict } from '@/services/clothingRecognition';
import {
  COLOR_HEX, COLOR_ORDER, TYPE_LABELS, TYPE_ORDER, normalize, urlToBase64, type FoundItem,
} from './importUtils';

type Analysis = 'pending' | 'done' | 'skipped' | 'failed';
type Row = FoundItem & { selected: boolean; analysis: Analysis; edited: boolean };
type Notice = 'unavailable' | 'limit' | null;

const MAX_AI_ITEMS = 60; // au-delà, les articles gardent la reconnaissance par nom
const PARALLEL = 2;      // analyses en même temps
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Applique le verdict de l'IA, sans écraser ce que tu as corrigé à la main. */
function applyVerdict(r: Row, v: ProductVerdict): Row {
  if (v.status === 'not-clothing') return { ...r, kind: 'other', selected: false, analysis: 'done' };
  if (v.status !== 'clothing') return { ...r, analysis: 'failed' };

  const s = v.suggestion;
  const base: Row = { ...r, kind: 'clothing', analysis: 'done', pattern: s.pattern ?? r.pattern, styles: s.styles ?? r.styles };
  if (r.edited) return base;
  return {
    ...base,
    type: s.type ?? r.type,
    typeKnown: s.type !== undefined || r.typeKnown,
    color: s.colors?.[0] ?? r.color,
    colorKnown: (s.colors?.length ?? 0) > 0 || r.colorKnown,
    extraColors: s.colors ? s.colors.slice(1) : r.extraColors,
  };
}

interface Props {
  items: FoundItem[];
  onBack: () => void;
  onConfirm: (selected: FoundItem[]) => void;
}

export default function ImportResults({ items, onBack, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((i) => ({ ...i, selected: false, analysis: i.kind === 'other' ? 'skipped' : 'pending', edited: false })),
  );
  const [query, setQuery] = useState('');
  const [showIgnored, setShowIgnored] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Vérification par IA, en tâche de fond : les articles incertains passent en premier
  useEffect(() => {
    let cancelled = false;

    const apply = (id: string, verdict: ProductVerdict) =>
      setRows((prev) => prev.map((r) => (r.id === id ? applyVerdict(r, verdict) : r)));

    (async () => {
      const todo = rows
        .filter((r) => r.analysis === 'pending')
        .sort((a, b) => Number(a.typeKnown) - Number(b.typeKnown))
        .slice(0, MAX_AI_ITEMS);
      let next = 0;
      let stop = false;

      const worker = async () => {
        while (!cancelled && !stop) {
          const item = todo[next++];
          if (!item) return;
          try {
            const { base64, mime } = await urlToBase64(item.image);
            const verdict = await analyzeProduct(base64, mime, item.name);
            if (cancelled) return;
            if (verdict.status === 'unavailable') { stop = true; setNotice('unavailable'); return; }
            if (verdict.status === 'rate-limited') { stop = true; setNotice('limit'); return; }
            apply(item.id, verdict);
          } catch {
            if (!cancelled) apply(item.id, { status: 'failed' });
          }
          await sleep(250);
        }
      };

      await Promise.all(Array.from({ length: PARALLEL }, () => worker()));
      // Ce qui n'a pas pu être analysé garde la reconnaissance par nom
      if (!cancelled) setRows((prev) => prev.map((r) => (r.analysis === 'pending' ? { ...r, analysis: 'failed' } : r)));
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ignored = rows.filter((r) => r.kind === 'other');
  const clothes = rows.filter((r) => r.kind !== 'other');
  const selected = rows.filter((r) => r.selected);
  const missingType = selected.filter((r) => !r.typeKnown).length;
  const total = rows.filter((r) => r.analysis !== 'skipped').length;
  const done = rows.filter((r) => r.analysis === 'done' || r.analysis === 'failed').length;
  const analysing = done < total && !notice;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return rows.filter((r) => (showIgnored || r.kind !== 'other') && (!q || normalize(r.name).includes(q)));
  }, [rows, query, showIgnored]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // « Tout cocher » ne coche que les vêtements dont le type est connu
  const toggleAll = () => {
    const targets = visible.filter((r) => r.kind === 'clothing' && r.typeKnown);
    const ids = new Set(targets.map((r) => r.id));
    const allOn = targets.length > 0 && targets.every((r) => r.selected);
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, selected: !allOn } : r)));
  };

  const cycle = <T,>(list: T[], current: T) => list[(list.indexOf(current) + 1) % list.length];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={Palette.text} />
        </Pressable>
        <Text style={styles.title}>Tes articles ({clothes.length})</Text>
        <Pressable onPress={toggleAll} hitSlop={12}>
          <Text style={styles.link}>Tout cocher</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Les articles qui ne sont pas des vêtements sont masqués. Touche le type ou la couleur d’un article pour les corriger.
      </Text>

      {analysing && (
        <View style={styles.banner}>
          <ActivityIndicator size="small" />
          <Text style={styles.bannerText}>Vérification par IA… {done}/{total}</Text>
        </View>
      )}
      {notice === 'unavailable' && (
        <Text style={styles.note}>Vérification par IA indisponible : reconnaissance par nom uniquement.</Text>
      )}
      {notice === 'limit' && (
        <Text style={styles.note}>Limite gratuite de l’IA atteinte : les articles restants gardent la reconnaissance par nom, vérifie-les.</Text>
      )}

      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={20} color={Palette.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Rechercher un article"
          placeholderTextColor={Palette.textSecondary}
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
        ListEmptyComponent={
          <Text style={styles.empty}>
            {clothes.length === 0 && ignored.length > 0
              ? "Aucun vêtement trouvé sur cette page. Ouvre ta liste de commandes ou ton panier, fais défiler, puis relance l'analyse."
              : 'Aucun article ne correspond.'}
          </Text>
        }
        ListFooterComponent={
          ignored.length > 0 ? (
            <Pressable style={styles.ignoredBtn} onPress={() => setShowIgnored((s) => !s)}>
              <MaterialCommunityIcons
                name={showIgnored ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={Palette.textSecondary}
              />
              <Text style={styles.ignoredText}>
                {showIgnored ? 'Masquer' : 'Afficher'} les {ignored.length} articles ignorés (pas des vêtements)
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => {
          const colors = [item.color, ...(item.extraColors ?? [])];
          return (
            <View
              style={[
                styles.row,
                item.selected && styles.rowActive,
                item.kind === 'other' && styles.rowIgnored,
              ]}
            >
              <Pressable
                onPress={() => update(item.id, { selected: !item.selected })}
                disabled={item.kind === 'other'}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name={item.selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                  size={26}
                  color={item.selected ? Palette.accent : Palette.textSecondary}
                />
              </Pressable>
              <Image source={{ uri: item.image }} style={styles.img} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>

                {item.kind === 'other' ? (
                  <View style={styles.pills}>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>Pas un vêtement</Text>
                    </View>
                    <Pressable
                      style={styles.pill}
                      onPress={() => update(item.id, { kind: 'unknown', analysis: 'skipped', edited: true })}
                    >
                      <Text style={styles.pillText}>Ajouter quand même</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.pills}>
                    <Pressable
                      style={[styles.pill, !item.typeKnown && styles.pillWarn]}
                      onPress={() =>
                        update(item.id, {
                          type: item.typeKnown ? cycle(TYPE_ORDER, item.type) : TYPE_ORDER[0],
                          typeKnown: true,
                          edited: true,
                        })
                      }
                    >
                      <Text style={[styles.pillText, !item.typeKnown && styles.pillWarnText]}>
                        {item.typeKnown ? TYPE_LABELS[item.type] : 'Type ?'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.pill}
                      onPress={() =>
                        update(item.id, { color: cycle(COLOR_ORDER, item.color), colorKnown: true, extraColors: [], edited: true })
                      }
                    >
                      {colors.map((c) => (
                        <View key={c} style={[styles.dot, { backgroundColor: COLOR_HEX[c] }]} />
                      ))}
                      <Text style={styles.pillText}>{item.colorKnown ? item.color : 'Couleur ?'}</Text>
                    </Pressable>
                    {item.analysis === 'pending' && <ActivityIndicator size="small" />}
                    {item.analysis === 'done' && (
                      <MaterialCommunityIcons name="creation" size={16} color={Palette.accent} accessibilityLabel="Vérifié par IA" />
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        {missingType > 0 && (
          <Text style={styles.note}>
            {missingType} article{missingType > 1 ? 's' : ''} coché{missingType > 1 ? 's' : ''} sans type : touche « Type ? » pour le choisir.
          </Text>
        )}
        <Pressable
          style={[styles.primary, (selected.length === 0 || missingType > 0) && styles.primaryDisabled]}
          disabled={selected.length === 0 || missingType > 0}
          onPress={() => onConfirm(selected)}
        >
          <Text style={styles.primaryText}>Importer {selected.length > 0 ? `(${selected.length})` : ''}</Text>
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
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Palette.accentSoft, borderRadius: 12, padding: 10,
  },
  bannerText: { color: Palette.text, fontSize: 13, fontWeight: '600' },
  note: { color: Palette.warning, paddingHorizontal: 16, marginBottom: 8, fontSize: 13 },
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
  rowIgnored: { opacity: 0.55 },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: Palette.surfaceRaised },
  info: { flex: 1, gap: 6 },
  name: { fontSize: 14, color: Palette.text },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surfaceRaised,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Palette.border,
  },
  pillWarn: { borderColor: Palette.warning },
  pillText: { fontSize: 12, textTransform: 'capitalize', color: Palette.textSecondary },
  pillWarnText: { color: Palette.warning, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: Palette.hairline },
  ignoredBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  ignoredText: { color: Palette.textSecondary, fontSize: 13 },
  footer: { padding: 16, gap: 6 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: Palette.surfaceSelected, opacity: 0.55 },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
});
