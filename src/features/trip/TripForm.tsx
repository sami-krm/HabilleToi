import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { STYLE_OPTIONS } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import { addDaysISO, todayISO } from '@/services/tripDates';
import { searchPlaces } from '@/services/tripWeather';
import type { Style } from '@/types';
import RangeCalendar from './RangeCalendar';
import type { Place } from './tripTypes';

const MAX_DAYS = 21;    // durée maximale d'un séjour
const MAX_OFFSET = 365; // départ au plus tard dans un an

export interface TripFormValues {
  place: Place;
  startDate: string;
  endDate: string;
  occasions: Style[];
}

interface Props {
  busy: boolean;
  error: string | null;
  wardrobeSize: number;
  onSubmit: (values: TripFormValues) => void;
  onCancel: () => void;
}

export default function TripForm({ busy, error, wardrobeSize, onSubmit, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [occasions, setOccasions] = useState<Style[]>(['casual']);

  // Dates : par défaut, départ dans 7 jours pour 5 jours sur place
  const today = todayISO();
  const [start, setStart] = useState<string | null>(() => addDaysISO(today, 7));
  const [end, setEnd] = useState<string | null>(() => addDaysISO(today, 11));

  // Recherche de ville avec un petit délai pour ne pas appeler l'API à chaque lettre
  useEffect(() => {
    if (place) return;
    const q = query.trim();
    if (q.length < 2) {
      const clearTimer = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(clearTimer);
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(q);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, place]);

  const choose = (p: Place) => {
    setPlace(p);
    setQuery(p.name);
    setResults([]);
  };

  const toggleOccasion = (s: Style) =>
    setOccasions((prev) => (prev.includes(s) ? (prev.length > 1 ? prev.filter((x) => x !== s) : prev) : [...prev, s]));

  const tooSmall = wardrobeSize < 3;
  const canSubmit = !!place && !!start && !!end && !busy && !tooSmall;

  return (
    <AuroraScreen>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={26} color={Palette.text} />
          </Pressable>
          <Text style={styles.title}>Nouvelle valise</Text>
        </View>

        <Text style={styles.label}>Destination</Text>
        <View style={styles.search}>
          <MaterialCommunityIcons name="map-marker-outline" size={20} color={Palette.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Ville (ex. Lisbonne)"
            placeholderTextColor={Palette.textSecondary}
            value={query}
            onChangeText={(t) => { setQuery(t); setPlace(null); }}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" />}
          {place && <MaterialCommunityIcons name="check-circle" size={20} color={Palette.success} />}
        </View>
        {results.map((r) => (
          <Pressable key={`${r.latitude},${r.longitude}`} style={styles.result} onPress={() => choose(r)}>
            <Text style={styles.resultName}>{r.name}</Text>
            <Text style={styles.resultSub}>{[r.region, r.country].filter(Boolean).join(', ')}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>Dates</Text>
        <RangeCalendar
          start={start}
          end={end}
          onChange={(s, e) => { setStart(s); setEnd(e); }}
          minDate={today}
          maxDate={addDaysISO(today, MAX_OFFSET)}
          maxDays={MAX_DAYS}
        />

        <Text style={styles.label}>Occasions</Text>
        <View style={styles.chips}>
          {STYLE_OPTIONS.map((o) => {
            const active = occasions.includes(o.key);
            return (
              <Pressable key={o.key} onPress={() => toggleOccasion(o.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={active ? styles.chipTextActive : styles.chipText}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tooSmall && (
          <Text style={styles.warn}>Ajoute au moins 3 vêtements dans l’onglet Dressing pour composer une valise.</Text>
        )}
        {error && <Text style={styles.warn}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primary, !canSubmit && styles.primaryDisabled]}
          disabled={!canSubmit}
          onPress={() => place && start && end && onSubmit({ place, startDate: start, endDate: end, occasions })}
        >
          {busy ? <ActivityIndicator color={Palette.onAccent} /> : <Text style={styles.primaryText}>Préparer ma valise</Text>}
        </Pressable>
      </View>
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 10, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: Palette.text },
  label: { fontSize: 16, fontWeight: '700', marginTop: 12, color: Palette.text },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Palette.surfaceRaised, borderColor: Palette.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: Palette.text },
  result: { backgroundColor: Palette.surface, borderColor: Palette.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  resultName: { fontSize: 16, fontWeight: '600', color: Palette.text },
  resultSub: { color: Palette.textSecondary, fontSize: 13, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Palette.surfaceRaised },
  chipActive: { backgroundColor: Palette.accent },
  chipText: { color: Palette.textSecondary },
  chipTextActive: { color: Palette.onAccent },
  warn: { color: Palette.warning, marginTop: 8 },
  footer: { padding: 20 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: Palette.surfaceSelected, opacity: 0.55 },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
});
