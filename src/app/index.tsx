import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';

import { OutfitSwipeDeck } from '@/components/OutfitSwipeDeck';
import MorningReminderModal from '@/features/notifications/MorningReminderModal';
import type { SwipeDeckHandle, SwipeDirection } from '@/components/OutfitSwipeDeck';
import { refreshMorningReminders } from '@/services/morningReminder';
import { getCurrentWeather, WeatherError } from '@/services/weatherService';
import { generateOutfit, outfitSignature } from '@/services/outfitGenerator';
import { useHistory } from '@/hooks/useHistory';
import { useWardrobe } from '@/hooks/useWardrobe';
import { loadFavorites, saveFavorites } from '@/storage/wardrobeStorage';
import type { Outfit, Style, Weather } from '@/types';

const OCCASIONS: { key: Style; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'sport', label: 'Sport' },
  { key: 'formel', label: 'Formel' },
  { key: 'soiree', label: 'Soirée' },
];

const DECK_SIZE = 2; // la tenue du dessus + celle qui attend derrière

interface LastAction {
  outfit: Outfit;
  direction: SwipeDirection;
  favoriteId?: string;
}

export default function HomeScreen() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [occasion, setOccasion] = useState<Style>('casual');
  const [queue, setQueue] = useState<Outfit[]>([]);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const deckRef = useRef<SwipeDeckHandle>(null);

  const { items, reload, setClean } = useWardrobe();
  const { entries: history, reload: reloadHistory, addWorn } = useHistory();

  const outfit = queue[0] ?? null;

  useFocusEffect(
    useCallback(() => {
      reload();
      reloadHistory();
    }, [reload, reloadHistory]),
  );

  const loadWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWeather(await getCurrentWeather());
    } catch (e) {
      setError(e instanceof WeatherError ? e.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadWeather(); }, [loadWeather]);

  // Remet à jour les rappels du matin avec la dernière prévision (sans bloquer l'écran)
  useEffect(() => { refreshMorningReminders().catch(() => {}); }, []);

  /** Tire une nouvelle tenue jamais vue dans cette série. */
  const draw = useCallback((): Outfit | null => {
    if (!weather) return null;
    const next = generateOutfit(items, weather, occasion, seenRef.current, history);
    if (next) seenRef.current.add(outfitSignature(next.items));
    return next;
  }, [history, items, occasion, weather]);

  /** Repart de zéro : nouvelle série de tenues. */
  const resetDeck = useCallback(() => {
    seenRef.current = new Set();
    const fresh: Outfit[] = [];
    while (fresh.length < DECK_SIZE) {
      const next = draw();
      if (!next) break;
      fresh.push(next);
    }
    setQueue(fresh);
    setLastAction(null);
  }, [draw]);

  // Nouvelle série quand la météo, l'occasion, le dressing ou l'historique changent
  useEffect(() => { resetDeck(); }, [resetDeck]);

  // ---------- Favoris ----------
  const addFavorite = useCallback(async (current: Outfit): Promise<string> => {
    const id = String(Date.now());
    const favs = await loadFavorites();
    await saveFavorites([...favs, { id, itemIds: current.items.map((i) => i.id), createdAt: Date.now() }]);
    return id;
  }, []);

  const removeFavorite = useCallback(async (id: string) => {
    const favs = await loadFavorites();
    await saveFavorites(favs.filter((f) => f.id !== id));
  }, []);

  // ---------- Swipe ----------
  const handleSwipe = useCallback((direction: SwipeDirection) => {
    const current = queue[0];
    if (!current) return;

    // L'interface avance tout de suite ; l'enregistrement se fait en arrière-plan
    const extra = draw();
    setQueue([...queue.slice(1), ...(extra ? [extra] : [])]);
    setLastAction({ outfit: current, direction });

    if (direction === 'right') {
      addFavorite(current)
        .then((favoriteId) => setLastAction((a) => (a?.outfit === current ? { ...a, favoriteId } : a)))
        .catch(() => Alert.alert('Erreur', "Impossible d'ajouter cette tenue aux favoris."));
    }
  }, [addFavorite, draw, queue]);

  const undo = useCallback(() => {
    if (!lastAction) return;
    Haptics.selectionAsync().catch(() => {});
    const restored = [lastAction.outfit, ...queue];
    // On ne garde que DECK_SIZE cartes ; celle qui sort pourra revenir plus tard
    while (restored.length > DECK_SIZE) {
      const dropped = restored.pop();
      if (dropped) seenRef.current.delete(outfitSignature(dropped.items));
    }
    setQueue(restored);
    if (lastAction.favoriteId) removeFavorite(lastAction.favoriteId).catch(() => {});
    setLastAction(null);
  }, [lastAction, queue, removeFavorite]);

  // Tenue portée : historique, puis on demande si les vêtements vont au sale
  const markWorn = () => {
    if (!outfit) return;
    const ids = outfit.items.map((i) => i.id);
    const record = async (dirty: boolean) => {
      await addWorn(ids);
      if (dirty) await setClean(ids, false);
    };
    Alert.alert('Tenue portée', 'Elle est ajoutée à ton historique. Marquer ces vêtements comme sales ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Non, garder propres', onPress: () => record(false) },
      { text: 'Oui, au sale', onPress: () => record(true) },
    ]);
  };

  // ---------- Rendu ----------
  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }
  if (error || !weather) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Météo indisponible.'}</Text>
        <Pressable style={styles.btn} onPress={loadWeather}>
          <Text style={styles.btnText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.weatherCard}>
          <Pressable style={styles.bell} onPress={() => setReminderOpen(true)} hitSlop={10} accessibilityLabel="Rappel du matin">
            <MaterialCommunityIcons name="bell-outline" size={24} color="#222" />
          </Pressable>
          {weather.city && <Text style={styles.city}>{weather.city}</Text>}
          <Text style={styles.temp}>{Math.round(weather.temperature)}°C</Text>
          <View style={styles.weatherRow}>
            <View style={styles.weatherItem}>
              <MaterialCommunityIcons name="weather-rainy" size={22} color="#222" />
              <Text style={styles.weatherLine}>{weather.precipitation} mm</Text>
            </View>
            <View style={styles.weatherItem}>
              <MaterialCommunityIcons name="weather-windy" size={22} color="#222" />
              <Text style={styles.weatherLine}>{Math.round(weather.windSpeed)} km/h</Text>
            </View>
          </View>
        </View>

        <View style={styles.chips}>
          {OCCASIONS.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => setOccasion(o.key)}
              style={[styles.chip, occasion === o.key && styles.chipActive]}
            >
              <Text style={occasion === o.key ? styles.chipTextActive : styles.chipText}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.title}>Ta tenue du jour</Text>

        {outfit ? (
          <>
            <OutfitSwipeDeck
              ref={deckRef}
              outfit={outfit}
              hasNext={queue.length > 1}
              onSwipe={handleSwipe}
            />
            <Text style={styles.swipeHint}>Glisse à droite pour garder · à gauche pour passer</Text>

            <View style={styles.swipeActions}>
              <Pressable
                style={[styles.roundBtn, styles.skipBtn]}
                onPress={() => deckRef.current?.swipe('left')}
                accessibilityLabel="Passer cette tenue"
              >
                <MaterialCommunityIcons name="close" size={30} color="#d94343" />
              </Pressable>
              <Pressable
                style={[styles.roundBtnSmall, !lastAction && styles.disabled]}
                onPress={undo}
                disabled={!lastAction}
                accessibilityLabel="Annuler le dernier swipe"
              >
                <MaterialCommunityIcons name="undo-variant" size={22} color="#555" />
              </Pressable>
              <Pressable
                style={[styles.roundBtn, styles.keepBtn]}
                onPress={() => deckRef.current?.swipe('right')}
                accessibilityLabel="Garder cette tenue en favori"
              >
                <MaterialCommunityIcons name="heart" size={28} color="#16834a" />
              </Pressable>
            </View>

            <Pressable style={[styles.btn, styles.btnWorn]} onPress={markWorn}>
              <MaterialCommunityIcons name="calendar-check" size={18} color="#fff" />
              <Text style={styles.btnText}>Je porte cette tenue</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="hanger" size={36} color="#999" />
            <Text style={styles.emptyText}>
              Plus de tenue à proposer. Ajoute des vêtements, lave ceux qui sont sales, ou revois les tenues déjà passées.
            </Text>
            <Pressable style={styles.btn} onPress={resetDeck}>
              <MaterialCommunityIcons name="autorenew" size={18} color="#fff" />
              <Text style={styles.btnText}>Revoir les tenues</Text>
            </Pressable>
            {lastAction && (
              <Pressable onPress={undo} hitSlop={10}>
                <Text style={styles.link}>Annuler le dernier swipe</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <MorningReminderModal visible={reminderOpen} onClose={() => setReminderOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, gap: 16, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { fontSize: 16, textAlign: 'center' },
  weatherCard: { backgroundColor: '#e8f1ff', borderRadius: 16, padding: 20, alignItems: 'center' },
  bell: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 1 },
  temp: { fontSize: 48, fontWeight: '700' },
  city: { fontSize: 16, fontWeight: '600', color: '#444' },
  weatherRow: { flexDirection: 'row', gap: 24, marginTop: 8 },
  weatherItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherLine: { fontSize: 16 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#222' },
  chipText: { color: '#222' },
  chipTextActive: { color: '#fff' },
  title: { fontSize: 20, fontWeight: '600' },
  swipeHint: { color: '#666', textAlign: 'center', fontSize: 13 },
  swipeActions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22 },
  roundBtn: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  skipBtn: { borderColor: '#d94343' },
  keepBtn: { borderColor: '#16834a' },
  roundBtnSmall: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f1f1',
  },
  disabled: { opacity: 0.35 },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyText: { color: '#666', textAlign: 'center' },
  link: { color: '#2F6FED', fontWeight: '600' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#222', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  btnWorn: { backgroundColor: '#2F6FED' },
  btnText: { color: '#fff', fontWeight: '600' },
});