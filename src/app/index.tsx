import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, AppState, Image, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';

import { AnimatedSegmented } from '@/components/AnimatedSegmented';
import AuroraScreen from '@/components/AuroraScreen';
import { ListRow } from '@/components/ListRow';
import { OutfitSwipeDeck } from '@/components/OutfitSwipeDeck';
import type { SwipeDeckHandle, SwipeDirection } from '@/components/OutfitSwipeDeck';
import ProfileModal from '@/components/ProfileModal';
import CityPickerModal from '@/components/CityPickerModal';
import { RoundAction } from '@/components/RoundAction';
import StylistModal from '@/components/StylistModal';
import { STYLE_OPTIONS, TYPE_LABELS } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import MorningReminderModal from '@/features/notifications/MorningReminderModal';
import { useHistory } from '@/hooks/useHistory';
import { useProfile } from '@/hooks/useProfile';
import { useWardrobe } from '@/hooks/useWardrobe';
import { generateOutfit, outfitSignature } from '@/services/outfitGenerator';
import { refreshMorningReminders } from '@/services/morningReminder';
import { getCurrentWeather, saveLocation, WeatherError, type SavedLocation } from '@/services/weatherService';
import { weatherVisual } from '@/services/weatherIcon';
import { findCalendarOccasion } from '@/services/calendarOccasion';
import { updateDailyOutfitWidget } from '@/widgets/updateDailyOutfitWidget';
import { loadFavorites, loadHistory, saveFavorites } from '@/storage/wardrobeStorage';
import {
  loadComfortFeedback, loadLaundryThresholds, loadOutfitPreferences, recordOutfitPreference, saveComfortFeedback,
  type OutfitPreferences,
} from '@/storage/preferences';
import type { ComfortFeedback, Outfit, Style, Weather } from '@/types';

const DAYS: { key: string; label: string }[] = [
  { key: '0', label: 'Aujourd’hui' },
  { key: '1', label: 'Demain' },
  { key: '2', label: 'Après-demain' },
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
  const [cityOpen, setCityOpen] = useState(false);
  const [stylistOpen, setStylistOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [calendarHint, setCalendarHint] = useState<Style | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [preferences, setPreferences] = useState<OutfitPreferences>({ liked: {}, rejected: {} });
  const [comfortBias, setComfortBias] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());
  const deckRef = useRef<SwipeDeckHandle>(null);
  const hasWeatherRef = useRef(false);
  const calendarStyleRef = useRef<Style | null>(null);
  const [scrollY] = useState(() => new Animated.Value(0));

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
  useEffect(() => { loadOutfitPreferences().then(setPreferences); }, []);
  useEffect(() => {
    loadComfortFeedback().then((entries) => {
      if (!entries.length) return;
      const recent = entries.slice(0, 12);
      setComfortBias(recent.reduce((sum, entry) => sum + (entry.feedback === 'too_cold' ? -1 : entry.feedback === 'too_hot' ? 1 : 0), 0) / recent.length * 3);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const previousStyle = calendarStyleRef.current;
    if (!profile.calendarEnabled) {
      calendarStyleRef.current = null;
      if (previousStyle) setOccasion((current) => current === previousStyle ? profile.style : current);
      return () => { active = false; };
    }

    const target = new Date();
    target.setDate(target.getDate() + dayOffset);
    findCalendarOccasion(target).then((detected) => {
      if (!active) return;
      if (detected) {
        calendarStyleRef.current = detected.style;
        setCalendarHint(detected.style);
        setOccasion(detected.style);
      } else {
        calendarStyleRef.current = null;
        setCalendarHint(null);
        if (previousStyle) setOccasion((current) => current === previousStyle ? profile.style : current);
      }
    }).catch(() => {
      if (active) setCalendarHint(null);
    });
    return () => { active = false; };
  }, [dayOffset, profile.calendarEnabled, profile.style]);

  useEffect(() => {
    if (dayOffset !== 0) return;
    const outfitText = outfit?.items.slice(0, 4).map((item) => `${TYPE_LABELS[item.type]} ${item.color}`).join(' · ') ?? '';
    updateDailyOutfitWidget({
      city: weather?.city ?? '',
      temperature: weather ? `${Math.round(weather.temperature)}°` : '',
      outfit: outfitText,
    });
  }, [dayOffset, outfit, weather]);

  const loadWeather = useCallback(async () => {
    if (!hasWeatherRef.current) setLoading(true);
    setError(null);
    try {
      setWeather(await getCurrentWeather(dayOffset));
      hasWeatherRef.current = true;
    } catch (e) {
      setError(e instanceof WeatherError ? e.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  }, [dayOffset]);
  useEffect(() => {
    const timer = setTimeout(() => { loadWeather(); }, 0);
    return () => clearTimeout(timer);
  }, [loadWeather]);
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previous.match(/inactive|background/) && next === 'active') loadWeather();
      previous = next;
    });
    return () => sub.remove();
  }, [loadWeather]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await loadWeather(); setRefreshing(false); }, [loadWeather]);
  const chooseCity = useCallback(async (location: SavedLocation | null) => {
    await saveLocation(location);
    setCityOpen(false);
    await loadWeather();
    refreshMorningReminders().catch(() => { });
  }, [loadWeather]);

  // Remet à jour les rappels du matin avec la dernière prévision (sans bloquer l'écran)
  useEffect(() => { refreshMorningReminders().catch(() => { }); }, []);

  /** Tire une nouvelle tenue jamais vue dans cette série. */
  const draw = useCallback((): Outfit | null => {
    if (!weather) return null;
    const coldOffset = profile.cold === 'frileux' ? -4 : profile.cold === 'chaud' ? 4 : 0;
    const next = generateOutfit(items, { ...weather, temperature: weather.temperature + coldOffset + comfortBias }, occasion, seenRef.current, history, preferences);
    if (next) seenRef.current.add(outfitSignature(next.items));
    return next;
  }, [history, items, occasion, weather, preferences, profile.cold, comfortBias]);

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
  useEffect(() => {
    const timer = setTimeout(resetDeck, 0);
    return () => clearTimeout(timer);
  }, [resetDeck]);

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

    const signature = outfitSignature(current.items);
    recordOutfitPreference(signature, direction).then(() => loadOutfitPreferences().then(setPreferences)).catch(() => { });
    if (direction === 'right') {
      addFavorite(current)
        .then((favoriteId) => setLastAction((a) => (a?.outfit === current ? { ...a, favoriteId } : a)))
        .catch(() => Alert.alert('Erreur', "Impossible d'ajouter cette tenue aux favoris."));
    }
  }, [addFavorite, draw, queue]);

  const undo = useCallback(() => {
    if (!lastAction) return;
    Haptics.selectionAsync().catch(() => { });
    const restored = [lastAction.outfit, ...queue];
    // On ne garde que DECK_SIZE cartes ; celle qui sort pourra revenir plus tard
    while (restored.length > DECK_SIZE) {
      const dropped = restored.pop();
      if (dropped) seenRef.current.delete(outfitSignature(dropped.items));
    }
    setQueue(restored);
    if (lastAction.favoriteId) removeFavorite(lastAction.favoriteId).catch(() => { });
    setLastAction(null);
  }, [lastAction, queue, removeFavorite]);

  // Tenue portée : historique, puis on demande si les vêtements vont au sale
  const markWorn = async () => {
    if (!outfit) return;
    const ids = outfit.items.map((i) => i.id);
    const now = Date.now();
    await addWorn(ids);
    const [thresholds, allHistory] = await Promise.all([loadLaundryThresholds(), loadHistory()]);
    const dirtyIds = outfit.items.filter((item) => allHistory.filter((entry) => entry.itemIds.includes(item.id) && entry.wornAt > (item.lastWashedAt ?? 0)).length >= thresholds[item.type]).map((item) => item.id);
    if (dirtyIds.length) await setClean(dirtyIds, false);
    const recordFeedback = (comfort: ComfortFeedback) => {
      saveComfortFeedback({ wornAt: now, feedback: comfort, temperature: weather?.temperature ?? 20 }).catch(() => { });
      setComfortBias((bias) => Math.max(-5, Math.min(5, bias + (comfort === 'too_cold' ? -1 : comfort === 'too_hot' ? 1 : 0))));
    };
    Alert.alert('Comment était ta tenue ?', 'Ton retour aide à ajuster les prochaines recommandations.', [
      { text: 'Trop chaud', onPress: () => recordFeedback('too_hot') },
      { text: 'Bien', onPress: () => recordFeedback('good') },
      { text: 'Trop froid', onPress: () => recordFeedback('too_cold') },
    ]);
  };

  // ---------- Rendu ----------
  if (loading) {
    return (
      <AuroraScreen variant="hero">
        <View style={styles.center}><ActivityIndicator size="large" color={Palette.white} /></View>
      </AuroraScreen>
    );
  }
  if (!weather) {
    return (
      <AuroraScreen variant="hero">
        <View style={styles.center}>
          <MaterialCommunityIcons name="weather-cloudy-alert" size={48} color={Palette.white} />
          <Text style={styles.error}>{error ?? 'Météo indisponible.'}</Text>
          <Pressable style={styles.primaryBtn} onPress={loadWeather}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </Pressable>
          <Pressable onPress={() => setCityOpen(true)} hitSlop={10}>
            <Text style={styles.link}>Choisir une ville manuellement</Text>
          </Pressable>
        </View>
        <CityPickerModal visible={cityOpen} onClose={() => setCityOpen(false)} onSelect={chooseCity} />
      </AuroraScreen>
    );
  }

  // Icône du temps (soleil, nuage, pluie...) d'après le code météo
  const visual = weatherVisual(weather.weatherCode, weather.isDay ?? true);

  // Températures affichées selon l'unité choisie dans le profil
  const toUnit = (t: number) => Math.round(profile.unit === 'F' ? t * 9 / 5 + 32 : t);
  const feels = weather.apparentTemperature ?? weather.temperature;
  const low = weather.minTemperature ?? weather.temperature;
  const high = weather.maxTemperature ?? weather.temperature;
  const advice = weather.rainTime
    ? `Prends une veste légère : pluie vers ${weather.rainTime}.`
    : low < 12 ? 'Prends une veste chaude pour ce matin.'
      : high > 22 ? 'Une tenue légère devrait suffire cet après-midi.'
        : 'Une veste légère peut être utile ce matin.';
  const dayTitle = dayOffset === 0 ? 'Ta tenue du jour' : dayOffset === 1 ? 'Ta tenue de demain' : 'Ta tenue d’après-demain';

  return (
    <AuroraScreen variant="hero" scrollY={scrollY}>
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.white} />}
      >
        {/* En-tête : profil, recherche de ville, rappel et favoris */}
        <View style={styles.header}>
          <Pressable style={styles.avatarBtn} onPress={() => setProfileOpen(true)} accessibilityLabel="Mon profil">
            {profile.avatar
              ? <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              : <MaterialCommunityIcons name="account" size={26} color={Palette.white} />}
          </Pressable>
          <Pressable style={styles.search} onPress={() => setCityOpen(true)} accessibilityLabel="Changer de ville">
            <MaterialCommunityIcons name="magnify" size={22} color={Palette.white} />
            <Text style={styles.searchText} numberOfLines={1}>Ville</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setReminderOpen(true)} hitSlop={6} accessibilityLabel="Rappel du matin">
            <MaterialCommunityIcons name="bell" size={21} color={Palette.white} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/outfits')} hitSlop={6} accessibilityLabel="Mes tenues">
            <MaterialCommunityIcons name="star" size={21} color={Palette.white} />
          </Pressable>
        </View>

        {error && <Text style={styles.softError}>{error}</Text>}

        {/* Grande température au centre, comme un solde */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel} numberOfLines={1}>{weather.city?.split(',')[0] ?? 'Ma position'} · {visual.label}</Text>
          <View style={styles.heroTempRow}>
            <Text style={styles.heroTemp} numberOfLines={1} adjustsFontSizeToFit>{toUnit(weather.temperature)}</Text>
            <Text style={styles.heroUnit}>°{profile.unit}</Text>
          </View>
          <View style={styles.heroPill}>
            <MaterialCommunityIcons name={visual.name} size={18} color={Palette.white} />
            <Text style={styles.heroPillText}>Ressenti {toUnit(feels)}°</Text>
          </View>
        </View>

        {/* Actions rapides */}
        <View style={styles.actionsRow}>
          <RoundAction icon="creation" label="Styliste" onPress={() => setStylistOpen(true)} />
          <RoundAction icon="check" label="Je la porte" onPress={markWorn} disabled={!outfit} />
          <RoundAction icon="autorenew" label="Nouvelle série" onPress={resetDeck} />
          <RoundAction icon="undo-variant" label="Annuler" onPress={undo} disabled={!lastAction} />
        </View>

        <AnimatedSegmented options={DAYS} value={String(dayOffset)} onChange={(key) => setDayOffset(Number(key))} />
        <AnimatedSegmented options={STYLE_OPTIONS} value={occasion} onChange={setOccasion} />
        {profile.calendarEnabled && calendarHint && (
          <Text style={styles.calendarHint}>
            Occasion détectée dans ton calendrier · {STYLE_OPTIONS.find((item) => item.key === calendarHint)?.label}
          </Text>
        )}

        {/* Détail de la météo, présenté comme une liste d'opérations */}
        <View style={styles.listCard}>
          <ListRow
            icon="thermometer"
            tint={Tints.temperature}
            title="Températures"
            subtitle="Matin · après-midi"
            value={`${toUnit(low)}° / ${toUnit(high)}°`}
          />
          <ListRow
            icon="weather-pouring"
            tint={Tints.rain}
            title="Pluie"
            subtitle={weather.rainTime ? `Vers ${weather.rainTime}` : 'Pas de pluie prévue'}
            value={`${weather.precipitation} mm`}
          />
          <ListRow
            icon="weather-windy"
            tint={Tints.wind}
            title="Vent"
            subtitle={weather.windSpeed > 30 ? 'Fort, couvre-toi' : 'Calme'}
            value={`${Math.round(weather.windSpeed)} km/h`}
          />
          <ListRow icon="lightbulb-on" tint={Tints.advice} title="Conseil" subtitle={advice} />
        </View>

        <Text style={styles.sectionTitle}>{dayTitle}{profile.name ? `, ${profile.name}` : ''}</Text>

        {outfit ? (
          <>
            <OutfitSwipeDeck ref={deckRef} outfit={outfit} hasNext={queue.length > 1} onSwipe={handleSwipe} />
            <View style={styles.swipeRow}>
              <Pressable style={styles.swipeBtn} onPress={() => deckRef.current?.swipe('left')} accessibilityLabel="Passer cette tenue">
                <MaterialCommunityIcons name="close" size={26} color={Palette.text} />
              </Pressable>
              <Text style={styles.swipeHint}>Glisse pour trier</Text>
              <Pressable
                style={[styles.swipeBtn, styles.keepBtn]}
                onPress={() => deckRef.current?.swipe('right')}
                accessibilityLabel="Garder cette tenue en favori"
              >
                <MaterialCommunityIcons name="heart" size={26} color={Palette.onAccent} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="hanger" size={36} color={Palette.textSecondary} />
            <Text style={styles.emptyText}>
              Plus de tenue à proposer. Ajoute des vêtements, lave ceux qui sont sales, ou revois les tenues déjà passées.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={resetDeck}>
              <Text style={styles.primaryBtnText}>Revoir les tenues</Text>
            </Pressable>
          </View>
        )}
      </Animated.ScrollView>

      <MorningReminderModal visible={reminderOpen} onClose={() => setReminderOpen(false)} />
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        update={updateProfile}
        onDataRestored={() => { reload(); reloadHistory(); }}
      />
      <CityPickerModal visible={cityOpen} onClose={() => setCityOpen(false)} onSelect={chooseCity} />
      <StylistModal visible={stylistOpen} onClose={() => setStylistOpen(false)} items={items} weather={weather} />
    </AuroraScreen>
  );
}

// Pastilles colorées des lignes météo
const Tints = {
  temperature: '#A8735A',
  rain: '#3B82F6',
  wind: '#1FBF8F',
  advice: '#7C5CFF',
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140, gap: 18 }, // marge basse : barre d'onglets
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  error: { fontSize: 16, textAlign: 'center', color: Palette.text },
  softError: { color: Palette.white, backgroundColor: 'rgba(255,107,122,0.25)', borderRadius: 14, padding: 10, overflow: 'hidden' },
  link: { color: Palette.white, fontWeight: '600', textDecorationLine: 'underline' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBtn: {
    width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
    backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 48, height: 48 },
  search: {
    flex: 1, height: 48, borderRadius: 24, paddingHorizontal: 14, gap: 8,
    flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.overlay,
  },
  searchText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '500' },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center',
  },

  hero: { alignItems: 'center', paddingTop: 56, paddingBottom: 40, gap: 6 },
  heroLabel: { color: Palette.white, fontSize: 17, fontWeight: '500', opacity: 0.9 },
  heroTempRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroTemp: { color: Palette.white, fontSize: 84, lineHeight: 92, fontWeight: '700', letterSpacing: -2 },
  heroUnit: { color: Palette.white, fontSize: 30, fontWeight: '700', marginBottom: 14, marginLeft: 4 },
  heroPill: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, backgroundColor: Palette.overlay,
  },
  heroPillText: { color: Palette.white, fontSize: 16, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  calendarHint: { color: Palette.accent, fontSize: 13, fontWeight: '600', marginTop: -8, textAlign: 'center' },

  listCard: { backgroundColor: Palette.surface, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 8 },

  sectionTitle: { fontSize: 22, fontWeight: '700', color: Palette.text, letterSpacing: -0.4, marginTop: 6 },
  swipeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  swipeBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center',
  },
  keepBtn: { backgroundColor: Palette.accent },
  swipeHint: { color: Palette.textSecondary, fontSize: 13 },

  emptyBox: { alignItems: 'center', gap: 14, paddingVertical: 28, paddingHorizontal: 16, backgroundColor: Palette.surface, borderRadius: 28 },
  emptyText: { color: Palette.textSecondary, textAlign: 'center' },
  primaryBtn: { backgroundColor: Palette.white, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999 },
  primaryBtnText: { color: Palette.black, fontWeight: '700', fontSize: 15 },
});
