import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { getCurrentWeather, WeatherError } from '@/services/weatherService';
import { generateOutfit, outfitSignature } from '@/services/outfitGenerator';
import { useHistory } from '@/hooks/useHistory';
import { useWardrobe } from '@/hooks/useWardrobe';
import { loadFavorites, saveFavorites } from '@/storage/wardrobeStorage';
import { allColors } from '@/types';
import type { Outfit, Style, Weather } from '@/types';

const OCCASIONS: { key: Style; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'sport', label: 'Sport' },
  { key: 'formel', label: 'Formel' },
  { key: 'soiree', label: 'Soirée' },
];

function createPanGesture(
  translateX: SharedValue<number>,
  screenWidth: number,
  onSwipe: (direction: 'left' | 'right') => void,
) {
  return Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const shouldSwipe = Math.abs(event.translationX) > screenWidth * 0.25
        || Math.abs(event.velocityX) > 900;
      if (!shouldSwipe) {
        translateX.value = withSpring(0);
        return;
      }

      const direction: 'left' | 'right' = Math.abs(event.translationX) > screenWidth * 0.25
        ? event.translationX > 0 ? 'right' : 'left'
        : event.velocityX > 0 ? 'right' : 'left';
      const destination = direction === 'right' ? screenWidth * 1.2 : -screenWidth * 1.2;
      translateX.value = withTiming(destination, { duration: 180 }, (finished) => {
        if (finished) scheduleOnRN(onSwipe, direction);
      });
    });
}

function returnCardToCenter(translateX: SharedValue<number>) {
  'worklet';
  translateX.value = withSpring(0);
}

function animateNextCard(
  translateX: SharedValue<number>,
  screenWidth: number,
  direction: 'left' | 'right',
) {
  'worklet';
  const start = direction === 'left' ? screenWidth * 0.15 : -screenWidth * 0.15;
  translateX.value = withTiming(start, { duration: 0 }, (finished) => {
    if (finished) translateX.value = withSpring(0);
  });
}

export default function HomeScreen() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [occasion, setOccasion] = useState<Style>('casual');
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);

  const { items, reload, setClean } = useWardrobe();
  const { entries: history, reload: reloadHistory, addWorn } = useHistory();

  // Recharge le dressing et l'historique à chaque retour sur l'onglet
  useFocusEffect(
    useCallback(() => {
      reload();
      reloadHistory();
    }, [reload, reloadHistory]),
  );

  // Météo à l'ouverture
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

  // Nouvelle tenue quand la météo, l'occasion, le dressing ou l'historique changent
  useEffect(() => {
    if (!weather) return;
    const nextSeen = new Set<string>();
    const next = generateOutfit(items, weather, occasion, new Set(), history);
    if (next) nextSeen.add(outfitSignature(next.items));
    setSeen(nextSeen);
    setOutfit(next);
  }, [weather, occasion, items, history]);

  const getNextOutfit = useCallback(() => {
    if (!weather) return null;
    const next = generateOutfit(items, weather, occasion, seen, history);
    if (!next) {
      return null;
    }
    setSeen((current) => new Set([...current, outfitSignature(next.items)]));
    return next;
  }, [history, items, occasion, seen, weather]);

  const regenerate = () => {
    const next = getNextOutfit();
    if (!next) {
      Alert.alert('Plus de combinaisons', 'Ajoute des vêtements ou lave ceux qui sont sales.');
      return;
    }
    setOutfit(next);
  };

  const persistFavorite = useCallback(async (currentOutfit: Outfit) => {
    const favs = await loadFavorites();
    await saveFavorites([
      ...favs,
      {
        id: String(Date.now()),
        itemIds: currentOutfit.items.map((i) => i.id),
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (direction === 'right' && outfit) {
      try {
        await persistFavorite(outfit);
      } catch {
        Alert.alert('Erreur', "Impossible d'ajouter cette tenue aux favoris.");
        scheduleOnUI(returnCardToCenter, translateX);
        return;
      }
    }

    const next = getNextOutfit();
    if (!next) {
      Alert.alert('Plus de combinaisons', 'Ajoute des vêtements ou lave ceux qui sont sales.');
      scheduleOnUI(returnCardToCenter, translateX);
      return;
    }

    setOutfit(next);
    scheduleOnUI(animateNextCard, translateX, screenWidth, direction);
  }, [getNextOutfit, outfit, persistFavorite, screenWidth, translateX]);

  const saveFavorite = async () => {
    if (!outfit) return;
    await persistFavorite(outfit);
    Alert.alert('Ajoutée aux favoris');
  };

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotateZ: `${interpolate(
          translateX.value,
          [-screenWidth, screenWidth],
          [-12, 12],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));
  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, screenWidth * 0.25], [0, 1], Extrapolation.CLAMP),
  }));
  const skipBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-screenWidth * 0.25, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const panGesture = useMemo(
    () => createPanGesture(translateX, screenWidth, handleSwipe),
    [handleSwipe, screenWidth, translateX],
  );

  // Tenue portée : enregistre dans l'historique, puis demande si les vêtements vont au sale
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
        {/* Météo */}
        <View style={styles.weatherCard}>
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

        {/* Occasion */}
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

        {/* Tenue du jour */}
        <Text style={styles.title}>Ta tenue du jour</Text>
        {outfit ? (
          <>
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.swipeCard, swipeStyle]}>
                <Animated.View style={[styles.swipeBadge, styles.keepBadge, keepBadgeStyle]} pointerEvents="none">
                  <MaterialCommunityIcons name="heart" size={20} color="#16834a" />
                  <Text style={[styles.swipeBadgeText, styles.keepBadgeText]}>GARDER</Text>
                </Animated.View>
                <Animated.View style={[styles.swipeBadge, styles.skipBadge, skipBadgeStyle]} pointerEvents="none">
                  <MaterialCommunityIcons name="close" size={20} color="#d94343" />
                  <Text style={[styles.swipeBadgeText, styles.skipBadgeText]}>PASSER</Text>
                </Animated.View>
                <View style={styles.grid}>
                  {outfit.items.map((item) => (
                    <View key={item.id} style={styles.piece}>
                      <Image source={{ uri: item.uri }} style={styles.pieceImg} />
                      <Text style={styles.pieceLabel}>{item.type} · {allColors(item).join(' / ')}</Text>
                    </View>
                  ))}
                </View>
                {outfit.notes.map((n) => <Text key={n} style={styles.note}>{n}</Text>)}
              </Animated.View>
            </GestureDetector>
            <Text style={styles.swipeHint}>Glisse à droite pour garder · à gauche pour passer</Text>

            <View style={styles.actions}>
              <Pressable style={styles.btn} onPress={regenerate}>
                <MaterialCommunityIcons name="autorenew" size={18} color="#fff" />
                <Text style={styles.btnText}>Autre tenue</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={saveFavorite}>
                <MaterialCommunityIcons name="star-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>Favori</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnWorn]} onPress={markWorn}>
                <MaterialCommunityIcons name="calendar-check" size={18} color="#fff" />
                <Text style={styles.btnText}>Portée</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.note}>
            Pas assez de vêtements propres pour composer une tenue. Ajoute des pièces dans l'onglet Dressing.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { fontSize: 16, textAlign: 'center' },
  weatherCard: { backgroundColor: '#e8f1ff', borderRadius: 16, padding: 20, alignItems: 'center' },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swipeCard: {
    position: 'relative',
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  swipeBadge: {
    position: 'absolute',
    top: 18,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  keepBadge: { left: 18, borderColor: '#16834a', transform: [{ rotate: '-10deg' }] },
  skipBadge: { right: 18, borderColor: '#d94343', transform: [{ rotate: '10deg' }] },
  swipeBadgeText: { fontSize: 15, fontWeight: '800' },
  keepBadgeText: { color: '#16834a' },
  skipBadgeText: { color: '#d94343' },
  swipeHint: { color: '#666', textAlign: 'center', fontSize: 13 },
  piece: { width: '47%' },
  pieceImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#f2f2f2' },
  pieceLabel: { marginTop: 4, textTransform: 'capitalize' },
  note: { color: '#a15c00' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#222', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  btnWorn: { backgroundColor: '#2F6FED' },
  btnText: { color: '#fff', fontWeight: '600' },
});