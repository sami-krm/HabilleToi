import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import FavoritesView from '@/features/outfits/FavoritesView';
import HistoryView from '@/features/outfits/HistoryView';
import { Palette } from '@/constants/theme';

type Segment = 'favorites' | 'history';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'favorites', label: 'Favoris' },
  { key: 'history', label: 'Historique' },
];

/** Onglet « Mes tenues » : regroupe les favoris et l'historique des tenues portées. */
export default function OutfitsScreen() {
  const [segment, setSegment] = useState<Segment>('favorites');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.segmented}>
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setSegment(s.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Une seule vue montée à la fois : elle recharge ses données à chaque affichage */}
      {segment === 'favorites' ? <FavoritesView /> : <HistoryView />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  segmented: {
    flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: 14, padding: 4,
    marginHorizontal: 20, marginTop: 16,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  segmentActive: { backgroundColor: Palette.surfaceSelected },
  segmentText: { color: Palette.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: Palette.accent },
});
