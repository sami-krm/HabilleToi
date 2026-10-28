import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Image, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { useHistory } from '@/hooks/useHistory';
import { useWardrobe } from '@/hooks/useWardrobe';
import { dayKey, daysAgo, signatureOfIds } from '@/services/historyUtils';
import type { WornOutfit } from '@/types';
import { Palette } from '@/constants/theme';

const REPEAT_WINDOW = 3; // une même tenue revenue en moins de 3 jours est signalée

function dayTitle(t: number): string {
  const d = daysAgo(t);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Hier';
  const s = new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HistoryView() {
  const { items, reload: reloadItems } = useWardrobe();
  const { entries, reload, removeEntry, clearAll } = useHistory();

  useFocusEffect(
    useCallback(() => {
      reloadItems();
      reload();
    }, [reloadItems, reload]),
  );

  // Regroupe les tenues par jour, les plus récentes en premier
  const sections = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.wornAt - a.wornAt);
    const byDay = new Map<string, { title: string; data: WornOutfit[] }>();
    for (const e of sorted) {
      const key = dayKey(e.wornAt);
      if (!byDay.has(key)) byDay.set(key, { title: dayTitle(e.wornAt), data: [] });
      byDay.get(key)!.data.push(e);
    }
    return [...byDay.values()];
  }, [entries]);

  const lastWeekCount = entries.filter((e) => daysAgo(e.wornAt) <= 6).length;

  // Cette tenue a-t-elle déjà été portée en moins de REPEAT_WINDOW jours avant ?
  const isRepeat = (e: WornOutfit) => {
    const sig = signatureOfIds(e.itemIds);
    return entries.some(
      (o) =>
        o.id !== e.id &&
        o.wornAt < e.wornAt &&
        daysAgo(o.wornAt, e.wornAt) <= REPEAT_WINDOW &&
        signatureOfIds(o.itemIds) === sig,
    );
  };

  const confirmRemove = (id: string) =>
    Alert.alert('Retirer cette tenue de l\'historique ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removeEntry(id) },
    ]);

  const confirmClear = () =>
    Alert.alert('Effacer tout l\'historique ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: () => clearAll() },
    ]);

  return (
    <View style={styles.safe}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Historique</Text>
            <Text style={styles.sub}>
              {lastWeekCount} tenue{lastWeekCount > 1 ? 's' : ''} portée{lastWeekCount > 1 ? 's' : ''} ces 7 derniers jours
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucune tenue enregistrée. Dans l’onglet Tenue, touche « Portée » après avoir choisi ta tenue : l’app évitera
            ensuite de te reproposer les mêmes vêtements plusieurs jours de suite.
          </Text>
        }
        ListFooterComponent={
          entries.length > 0 ? (
            <Pressable style={styles.clearBtn} onPress={confirmClear}>
              <Text style={styles.clearText}>Effacer l’historique</Text>
            </Pressable>
          ) : null
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item: e }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.time}>
                {new Date(e.wornAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isRepeat(e) && (
                <View style={styles.repeatBadge}>
                  <MaterialCommunityIcons name="repeat" size={13} color={Palette.warning} />
                  <Text style={styles.repeatText}>Répétée</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => confirmRemove(e.id)} hitSlop={10}>
                <MaterialCommunityIcons name="trash-can-outline" size={22} color={Palette.danger} />
              </Pressable>
            </View>

            <View style={styles.pieces}>
              {e.itemIds.map((id) => {
                const item = items.find((i) => i.id === id);
                return item ? (
                  <View key={id} style={styles.piece}>
                    <Image source={{ uri: item.uri }} style={styles.img} />
                    <Text style={styles.pieceLabel} numberOfLines={1}>{item.type}</Text>
                  </View>
                ) : (
                  // vêtement supprimé du dressing depuis
                  <View key={id} style={styles.piece}>
                    <View style={[styles.img, styles.missing]}>
                      <MaterialCommunityIcons name="image-off-outline" size={22} color={Palette.textSecondary} />
                    </View>
                    <Text style={styles.pieceLabel}>supprimé</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, gap: 8, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  header: { gap: 4, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: Palette.text },
  sub: { color: Palette.textSecondary },
  empty: { color: Palette.textSecondary, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4, color: Palette.text },
  card: { backgroundColor: Palette.surface, borderColor: Palette.border, borderWidth: 1, borderRadius: 18, padding: 12, gap: 8, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { color: Palette.textSecondary },
  repeatBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Palette.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  repeatText: { color: Palette.warning, fontSize: 12, fontWeight: '600' },
  pieces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  piece: { width: 64 },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: Palette.surfaceRaised },
  missing: { alignItems: 'center', justifyContent: 'center' },
  pieceLabel: { fontSize: 11, textTransform: 'capitalize', marginTop: 2, color: Palette.text },
  clearBtn: { alignSelf: 'center', marginTop: 16, padding: 12 },
  clearText: { color: Palette.danger, fontWeight: '600' },
});
