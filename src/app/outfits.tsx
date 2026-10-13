import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { Glass, Palette } from '@/constants/theme';
import FavoritesView from '@/features/outfits/FavoritesView';
import HistoryView from '@/features/outfits/HistoryView';

type Segment = 'favorites' | 'history';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'favorites', label: 'Favoris' },
  { key: 'history', label: 'Historique' },
];

/** Onglet « Mes tenues » : regroupe les favoris et l'historique des tenues portées. */
export default function OutfitsScreen() {
  const [segment, setSegment] = useState<Segment>('favorites');

  return (
    <AuroraScreen>
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
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  segmented: { ...Glass, flexDirection: 'row', borderRadius: 22, padding: 4, marginHorizontal: 20, marginTop: 16 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 18 },
  segmentActive: { backgroundColor: Palette.ink },
  segmentText: { color: Palette.textSecondary, fontWeight: '700' },
  segmentTextActive: { color: Palette.onAccent },
});