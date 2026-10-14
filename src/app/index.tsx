import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { GlassCard } from '@/components/GlassCard';
import { OutfitSwipeDeck } from '@/components/OutfitSwipeDeck';
import type { SwipeDeckHandle, SwipeDirection } from '@/components/OutfitSwipeDeck';
import ProfileModal from '@/components/ProfileModal';
import { Glass, Palette } from '@/constants/theme';
import MorningReminderModal from '@/features/notifications/MorningReminderModal';
import { useHistory } from '@/hooks/useHistory';
import { useProfile } from '@/hooks/useProfile';
import { useWardrobe } from '@/hooks/useWardrobe';
import { generateOutfit, outfitSignature } from '@/services/outfitGenerator';
import { refreshMorningReminders } from '@/services/morningReminder';
import { getCurrentWeather, WeatherError } from '@/services/weatherService';
import { weatherVisual } from '@/services/weatherIcon';
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
  const [profileOpen, setProfileOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const deckRef = useRef<SwipeDeckHandle>(null);

  const { items, reload, setClean } = useWardrobe();
  const { entries: history, reload: reloadHistory, addWorn } = useHistory();
  const { profile, update: updateProfile } = useProfile();

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
    return (
      <AuroraScreen>
        <View style={styles.center}><ActivityIndicator size="large" color={Palette.accent} /></View>
      </AuroraScreen>
    );
  }
  if (error || !weather) {
    return (
      <AuroraScreen>
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Météo indisponible.'}</Text>
          <Pressable style={styles.btn} onPress={loadWeather}>
            <Text style={styles.btnText}>Réessayer</Text>
          </Pressable>
        </View>
      </AuroraScreen>
    );
  }

  // Icône du temps (soleil, nuage, pluie...) d'après le code météo
  const visual = weatherVisual(weather.weatherCode, weather.isDay ?? true);

  // Température affichée selon l'unité choisie dans le profil
  const shownTemp = profile.unit === 'F'
    ? Math.round(weather.temperature * 9 / 5 + 32)
    : Math.round(weather.temperature);

  return (
    <AuroraScreen>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête : ville à gauche, cloche puis profil à droite */}
        <View style={styles.headerTop}>
          <View style={styles.cityChip}>
            <MaterialCommunityIcons name="map-marker" size={16} color={Palette.accent} />
            <Text style={styles.cityText}>{weather.city ?? 'Ma position'}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.iconBtn} onPress={() => setReminderOpen(true)} hitSlop={10} accessibilityLabel="Rappel du matin">
              <MaterialCommunityIcons name="bell-outline" size={22} color={Palette.text} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => setProfileOpen(true)} hitSlop={10} accessibilityLabel="Mon profil">
              {profile.avatar
                ? <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                : <MaterialCommunityIcons name="account-outline" size={24} color={Palette.text} />}
            </Pressable>
          </View>
        </View>

        {/* Température + infos météo dans une carte liquid glass */}
        <GlassCard>
          <View style={styles.tempRow}>
            <Text style={styles.temp} numberOfLines={1} adjustsFontSizeToFit>
              {shownTemp}°
            </Text>
            <View style={styles.stats}>
              <View style={styles.statRow}>
                <MaterialCommunityIcons name="water-outline" size={22} color={Palette.accent} />
                <Text style={styles.statText}>Pluie {weather.precipitation} mm</Text>
              </View>
              <View style={styles.statRow}>
                <MaterialCommunityIcons name="weather-windy" size={22} color={Palette.accent} />
                <Text style={styles.statText}>Vent {Math.round(weather.windSpeed)} km/h</Text>
              </View>
            </View>
            <MaterialCommunityIcons name={visual.name} size={56} color={visual.color} accessibilityLabel={visual.label} />
          </View>
        </GlassCard>

        {/* Occasion : sélecteur en verre */}
        <View style={styles.segmented}>
          {OCCASIONS.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => setOccasion(o.key)}
              style={[styles.segment, occasion === o.key && styles.segmentActive]}
            >
              <Text style={occasion === o.key ? styles.segmentTextActive : styles.segmentText}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.title}>
          {profile.name ? `Ta tenue du jour, ${profile.name}` : 'Ta tenue du jour'}
        </Text>

        {outfit ? (
          <>
            <OutfitSwipeDeck
              ref={deckRef}
              outfit={outfit}
              hasNext={queue.length > 1}
              onSwipe={handleSwipe}
            />
            <Text style={styles.swipeHint}>Glisse à droite pour garder · à gauche pour passer</Text>

            <View style={styles.actionRow}>
              <Pressable
                style={styles.sideBtn}
                onPress={() => deckRef.current?.swipe('left')}
                accessibilityLabel="Passer cette tenue"
              >
                <MaterialCommunityIcons name="close" size={24} color={Palette.text} />
              </Pressable>
              <Pressable style={styles.wornBtn} onPress={markWorn}>
                <Text style={styles.wornText}>Je la porte</Text>
              </Pressable>
              <Pressable
                style={[styles.sideBtn, styles.keepBtn]}
                onPress={() => deckRef.current?.swipe('right')}
                accessibilityLabel="Garder cette tenue en favori"
              >
                <MaterialCommunityIcons name="heart" size={24} color={Palette.onAccent} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.undo, !lastAction && styles.disabled]}
              onPress={undo}
              disabled={!lastAction}
              accessibilityLabel="Annuler le dernier swipe"
            >
              <MaterialCommunityIcons name="undo-variant" size={16} color={Palette.textSecondary} />
              <Text style={styles.undoText}>Annuler le dernier swipe</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="hanger" size={36} color={Palette.textSecondary} />
            <Text style={styles.emptyText}>
              Plus de tenue à proposer. Ajoute des vêtements, lave ceux qui sont sales, ou revois les tenues déjà passées.
            </Text>
            <Pressable style={styles.btn} onPress={resetDeck}>
              <MaterialCommunityIcons name="autorenew" size={18} color={Palette.onAccent} />
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
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        update={updateProfile}
      />
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { fontSize: 16, textAlign: 'center', color: Palette.text },

  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityChip: {
    ...Glass, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  cityText: { fontSize: 13, fontWeight: '700', color: Palette.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    ...Glass, width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 40, height: 40 },

  tempRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  temp: { flexShrink: 1, fontSize: 84, lineHeight: 90, fontWeight: '800', letterSpacing: -3, color: Palette.text },
  stats: { gap: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { fontSize: 17, fontWeight: '700', color: Palette.textSecondary },

  segmented: { ...Glass, flexDirection: 'row', borderRadius: 22, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 18 },
  segmentActive: { backgroundColor: Palette.ink },
  segmentText: { color: Palette.textSecondary, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: Palette.onAccent, fontWeight: '700', fontSize: 13 },

  title: { fontSize: 22, fontWeight: '800', color: Palette.text, letterSpacing: -0.4 },
  swipeHint: { color: Palette.textSecondary, textAlign: 'center', fontSize: 13 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sideBtn: { ...Glass, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  keepBtn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  wornBtn: { flex: 1, height: 56, borderRadius: 28, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  wornText: { color: Palette.onAccent, fontSize: 16, fontWeight: '800' },
  undo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  undoText: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.35 },

  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyText: { color: Palette.textSecondary, textAlign: 'center' },
  link: { color: Palette.accent, fontWeight: '600' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Palette.accent, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16,
  },
  btnText: { color: Palette.onAccent, fontWeight: '600' },
});