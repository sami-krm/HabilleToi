import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { addDaysISO, formatShort, todayISO } from '@/services/tripDates';
import { searchPlaces } from '@/services/tripWeather';
import type { Style } from '@/types';
import type { Place } from './tripTypes';

const OCCASIONS: { key: Style; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'sport', label: 'Sport' },
  { key: 'formel', label: 'Formel' },
  { key: 'soiree', label: 'Soirée' },
];

const MAX_DAYS = 21;
const MAX_OFFSET = 365;

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

function Stepper({
  label, value, onChange, min, max, steps,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; steps: number[] }) {
  const change = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));
  return (
    <View style={styles.stepper}>
      {[...steps].reverse().map((s) => (
        <Pressable key={`m${s}`} style={styles.stepBtn} onPress={() => change(-s)}>
          <Text style={styles.stepText}>−{s}</Text>
        </Pressable>
      ))}
      <Text style={styles.stepValue}>{label}</Text>
      {steps.map((s) => (
        <Pressable key={`p${s}`} style={styles.stepBtn} onPress={() => change(s)}>
          <Text style={styles.stepText}>+{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TripForm({ busy, error, wardrobeSize, onSubmit, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [offset, setOffset] = useState(7);      // départ dans N jours
  const [duration, setDuration] = useState(5);  // nombre de jours sur place
  const [occasions, setOccasions] = useState<Style[]>(['casual']);

  const startDate = addDaysISO(todayISO(), offset);
  const endDate = addDaysISO(startDate, duration - 1);

  // Recherche de ville avec un petit délai pour ne pas appeler l'API à chaque lettre
  useEffect(() => {
    if (place) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
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
  const canSubmit = !!place && !busy && !tooSmall;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#222" />
          </Pressable>
          <Text style={styles.title}>Nouvelle valise</Text>
        </View>

        <Text style={styles.label}>Destination</Text>
        <View style={styles.search}>
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#666" />
          <TextInput
            style={styles.input}
            placeholder="Ville (ex. Lisbonne)"
            value={query}
            onChangeText={(t) => { setQuery(t); setPlace(null); }}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" />}
          {place && <MaterialCommunityIcons name="check-circle" size={20} color="#2E8B57" />}
        </View>
        {results.map((r) => (
          <Pressable key={`${r.latitude},${r.longitude}`} style={styles.result} onPress={() => choose(r)}>
            <Text style={styles.resultName}>{r.name}</Text>
            <Text style={styles.resultSub}>{[r.region, r.country].filter(Boolean).join(', ')}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>Départ</Text>
        <Text style={styles.dateText}>{formatShort(startDate)}</Text>
        <Stepper label="jours" value={offset} onChange={setOffset} min={0} max={MAX_OFFSET} steps={[1, 7]} />

        <Text style={styles.label}>Durée</Text>
        <Text style={styles.dateText}>
          {duration} jour{duration > 1 ? 's' : ''} · retour le {formatShort(endDate)}
        </Text>
        <Stepper label="jours" value={duration} onChange={setDuration} min={1} max={MAX_DAYS} steps={[1, 3]} />

        <Text style={styles.label}>Occasions</Text>
        <View style={styles.chips}>
          {OCCASIONS.map((o) => {
            const active = occasions.includes(o.key);
            return (
              <Pressable key={o.key} onPress={() => toggleOccasion(o.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={active ? styles.chipTextActive : styles.chipText}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tooSmall && (
          <Text style={styles.warn}>Ajoute au moins 3 vêtements dans l'onglet Dressing pour composer une valise.</Text>
        )}
        {error && <Text style={styles.warn}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primary, !canSubmit && styles.primaryDisabled]}
          disabled={!canSubmit}
          onPress={() => place && onSubmit({ place, startDate, endDate, occasions })}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Préparer ma valise</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 20, gap: 10, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f2f2f2', borderRadius: 12, paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },
  result: { backgroundColor: '#f6f6f6', borderRadius: 12, padding: 12 },
  resultName: { fontSize: 16, fontWeight: '600' },
  resultSub: { color: '#666', fontSize: 13, marginTop: 2 },
  dateText: { color: '#444', fontSize: 15, textTransform: 'capitalize' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { backgroundColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  stepText: { fontWeight: '700', color: '#222' },
  stepValue: { flex: 1, textAlign: 'center', color: '#666' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#222' },
  chipText: { color: '#222' },
  chipTextActive: { color: '#fff' },
  warn: { color: '#a15c00', marginTop: 8 },
  footer: { padding: 20 },
  primary: { backgroundColor: '#222', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: '#bbb' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});