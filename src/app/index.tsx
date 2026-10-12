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
import { Palette } from '@/constants/theme';
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
            <MaterialCommunityIcons name="bell-outline" size={24} color={Palette.text} />
          </Pressable>
          {weather.city && <Text style={styles.city}>{weather.city}</Text>}
          <Text style={styles.temp}>{Math.round(weather.temperature)}°C</Text>
          <View style={styles.weatherRow}>
            <View style={styles.weatherItem}>
              <MaterialCommunityIcons name="weather-rainy" size={22} color={Palette.accent} />
              <Text style={styles.weatherLine}>{weather.precipitation} mm</Text>
            </View>
            <View style={styles.weatherItem}>
              <MaterialCommunityIcons name="weather-windy" size={22} color={Palette.accent} />
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
                <MaterialCommunityIcons name="close" size={30} color={Palette.danger} />
              </Pressable>
              <Pressable
                style={[styles.roundBtnSmall, !lastAction && styles.disabled]}
                onPress={undo}
                disabled={!lastAction}
                accessibilityLabel="Annuler le dernier swipe"
              >
                <MaterialCommunityIcons name="undo-variant" size={22} color={Palette.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.roundBtn, styles.keepBtn]}
                onPress={() => deckRef.current?.swipe('right')}
                accessibilityLabel="Garder cette tenue en favori"
              >
                <MaterialCommunityIcons name="heart" size={28} color={Palette.accent} />
              </Pressable>
            </View>

            <Pressable style={[styles.btn, styles.btnWorn]} onPress={markWorn}>
              <MaterialCommunityIcons name="calendar-check" size={18} color={Palette.white} />
              <Text style={[styles.btnText, styles.btnWornText]}>Je porte cette tenue</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="hanger" size={36} color={Palette.textSecondary} />
            <Text style={styles.emptyText}>
              Plus de tenue à proposer. Ajoute des vêtements, lave ceux qui sont sales, ou revois les tenues déjà passées.
            </Text>
            <Pressable style={styles.btn} onPress={resetDeck}>
              <MaterialCommunityIcons name="autorenew" size={18} color={Palette.black} />
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
  safe: { flex: 1, backgroundColor: Palette.background },
  container: { padding: 20, gap: 16, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: Palette.background },
  error: { fontSize: 16, textAlign: 'center', color: Palette.text },
  weatherCard: { backgroundColor: Palette.accentSoft, borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Palette.border },
  bell: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 1 },
  temp: { fontSize: 50, fontWeight: '700', color: Palette.text, letterSpacing: -2 },
  city: { fontSize: 16, fontWeight: '600', color: Palette.textSecondary },
  weatherRow: { flexDirection: 'row', gap: 24, marginTop: 8 },
  weatherItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherLine: { fontSize: 16, color: Palette.text },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: Palette.surfaceRaised },
  chipActive: { backgroundColor: Palette.accent },
  chipText: { color: Palette.textSecondary },
  chipTextActive: { color: Palette.black, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: Palette.text, letterSpacing: -0.4 },
  swipeHint: { color: Palette.textSecondary, textAlign: 'center', fontSize: 13 },
  swipeActions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22 },
  roundBtn: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.surfaceRaised, borderWidth: 1, borderColor: Palette.border,
    shadowColor: Palette.black, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  skipBtn: { borderColor: Palette.danger },
  keepBtn: { borderColor: Palette.accent },
  roundBtnSmall: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.surfaceRaised, borderWidth: 1, borderColor: Palette.border,
  },
  disabled: { opacity: 0.35 },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyText: { color: Palette.textSecondary, textAlign: 'center' },
  link: { color: Palette.accent, fontWeight: '600' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Palette.accent, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16,
  },
  btnWorn: { backgroundColor: Palette.surfaceRaised, borderWidth: 1, borderColor: Palette.border },
  btnText: { color: Palette.black, fontWeight: '600' },
  btnWornText: { color: Palette.text },
});
