import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import TripForm from '@/features/trip/TripForm';
import type { TripFormValues } from '@/features/trip/TripForm';
import TripResult from '@/features/trip/TripResult';
import type { SavedTrip } from '@/features/trip/tripTypes';
import { useWardrobe } from '@/hooks/useWardrobe';
import { generatePacking } from '@/services/packingGenerator';
import { diffDays, formatShort } from '@/services/tripDates';
import { getTripWeather, TripWeatherError } from '@/services/tripWeather';
import { loadTrips, saveTrips } from '@/storage/tripStorage';
import { Palette } from '@/constants/theme';

type Screen = { name: 'list' } | { name: 'form' } | { name: 'result'; id: string };

export default function TripScreen() {
  const { items, reload } = useWardrobe();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
      loadTrips().then(setTrips);
    }, [reload]),
  );

  const persist = useCallback(async (next: SavedTrip[]) => {
    setTrips(next);
    await saveTrips(next);
  }, []);

  const createTrip = async (v: TripFormValues) => {
    setBusy(true);
    setError(null);
    try {
      const weather = await getTripWeather(v.place, v.startDate, v.endDate);
      const packing = generatePacking({ wardrobe: items, days: weather.days, occasions: v.occasions });
      const trip: SavedTrip = {
        id: String(Date.now()),
        place: v.place,
        startDate: v.startDate,
        endDate: v.endDate,
        occasions: v.occasions,
        weather,
        itemIds: packing.items.map((i) => i.id),
        dayOutfits: packing.dayOutfits,
        notes: packing.notes,
        packed: [],
        createdAt: Date.now(),
      };
      await persist([trip, ...trips]);
      setScreen({ name: 'result', id: trip.id });
    } catch (e) {
      setError(e instanceof TripWeatherError ? e.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const update = (id: string, patch: (t: SavedTrip) => SavedTrip) =>
    persist(trips.map((t) => (t.id === id ? patch(t) : t)));

  // ---------- Formulaire ----------
  if (screen.name === 'form') {
    return (
      <TripForm
        busy={busy}
        error={error}
        wardrobeSize={items.length}
        onSubmit={createTrip}
        onCancel={() => { setError(null); setScreen({ name: 'list' }); }}
      />
    );
  }

  // ---------- Résultat ----------
  if (screen.name === 'result') {
    const trip = trips.find((t) => t.id === screen.id);
    if (!trip) {
      setScreen({ name: 'list' });
      return null;
    }
    return (
      <TripResult
        trip={trip}
        wardrobe={items}
        onBack={() => setScreen({ name: 'list' })}
        onTogglePacked={(itemId) =>
          update(trip.id, (t) => ({
            ...t,
            packed: t.packed.includes(itemId) ? t.packed.filter((x) => x !== itemId) : [...t.packed, itemId],
          }))
        }
        onRegenerate={() => {
          // Même météo et mêmes occasions, avec plus de variété
          const packing = generatePacking({
            wardrobe: items, days: trip.weather.days, occasions: trip.occasions, variation: 2.5,
          });
          update(trip.id, (t) => ({
            ...t,
            itemIds: packing.items.map((i) => i.id),
            dayOutfits: packing.dayOutfits,
            notes: packing.notes,
            packed: [],
          }));
        }}
        onDelete={async () => {
          await persist(trips.filter((t) => t.id !== trip.id));
          setScreen({ name: 'list' });
        }}
      />
    );
  }

  // ---------- Liste des valises ----------
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Mes valises</Text>
            <Pressable style={styles.btn} onPress={() => setScreen({ name: 'form' })}>
              <MaterialCommunityIcons name="plus" size={18} color={Palette.black} />
              <Text style={styles.btnText}>Nouvelle valise</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bag-suitcase-outline" size={48} color={Palette.accent} />
            <Text style={styles.emptyText}>
              Choisis une destination et des dates : l'app compose une valise de vêtements qui vont bien ensemble,
              adaptés à la météo du séjour.
            </Text>
          </View>
        }
        renderItem={({ item: t }) => {
          const total = t.itemIds.filter((id) => items.some((i) => i.id === id)).length;
          const packed = t.packed.filter((id) => t.itemIds.includes(id)).length;
          const nights = diffDays(t.startDate, t.endDate) + 1;
          return (
            <Pressable style={styles.card} onPress={() => setScreen({ name: 'result', id: t.id })}>
              <MaterialCommunityIcons name="bag-suitcase-outline" size={28} color={Palette.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t.place.name}</Text>
                <Text style={styles.cardSub}>
                  {formatShort(t.startDate)} · {nights} jour{nights > 1 ? 's' : ''}
                </Text>
                <Text style={styles.cardSub}>{packed} / {total} pièces rangées</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={Palette.textSecondary} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  list: { padding: 20, gap: 12, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  header: { gap: 12, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: Palette.text },
  empty: { alignItems: 'center', gap: 12, marginTop: 32 },
  emptyText: { color: Palette.textSecondary, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.surface, borderColor: Palette.border, borderWidth: 1, borderRadius: 18, padding: 14 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Palette.text },
  cardSub: { color: Palette.textSecondary, fontSize: 13, textTransform: 'capitalize' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Palette.accent, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
  },
  btnText: { color: Palette.black, fontWeight: '600' },
});
