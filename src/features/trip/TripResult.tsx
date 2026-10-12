import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, type ComponentProps } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PACK_ORDER, typePlural, typeSingular } from '@/services/packingGenerator';
import { formatDay, formatShort } from '@/services/tripDates';
import { allColors } from '@/types';
import type { ClothingItem, ColorName } from '@/types';
import type { DayWeather, SavedTrip } from './tripTypes';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const COLOR_HEX: Record<ColorName, string> = {
  noir: '#111111', blanc: '#FFFFFF', gris: '#9E9E9E', beige: '#D8C3A5',
  marine: '#1F2A44', marron: '#6B4423', bleu: '#2F6FED', rouge: '#D32F2F',
  vert: '#2E8B57', jaune: '#F4C430', orange: '#F57C00', rose: '#F48FB1', violet: '#7E57C2',
};

function weatherIcon(d: DayWeather): IconName {
  if (d.precipitation >= 1) return 'weather-rainy';
  if (d.tMax >= 24) return 'weather-sunny';
  if (d.tMax >= 14) return 'weather-partly-cloudy';
  return 'weather-cloudy';
}

interface Props {
  trip: SavedTrip;
  wardrobe: ClothingItem[];
  onBack: () => void;
  onTogglePacked: (id: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export default function TripResult({ trip, wardrobe, onBack, onTogglePacked, onRegenerate, onDelete }: Props) {
  const byId = useMemo(() => new Map(wardrobe.map((i) => [i.id, i])), [wardrobe]);
  const items = trip.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => !!i);
  const packedCount = items.filter((i) => trip.packed.includes(i.id)).length;

  const days = trip.weather.days;
  const lowest = Math.round(Math.min(...days.map((d) => d.tMin)));
  const highest = Math.round(Math.max(...days.map((d) => d.tMax)));
  const rainDays = days.filter((d) => d.precipitation >= 1).length;

  const confirmDelete = () =>
    Alert.alert('Supprimer cette valise ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#222" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{trip.place.name}</Text>
            <Text style={styles.sub}>
              {formatShort(trip.startDate)} → {formatShort(trip.endDate)}
            </Text>
          </View>
        </View>

        {/* Météo du séjour */}
        <View style={styles.weatherCard}>
          <Text style={styles.range}>{lowest}° / {highest}°C</Text>
          <Text style={styles.rainText}>
            {rainDays === 0 ? 'Pas de pluie prévue' : `Pluie ${rainDays} jour${rainDays > 1 ? 's' : ''} sur ${days.length}`}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
            {days.map((d) => (
              <View key={d.date} style={styles.dayChip}>
                <Text style={styles.dayChipDate}>{formatDay(d.date)}</Text>
                <MaterialCommunityIcons name={weatherIcon(d)} size={22} color="#222" />
                <Text style={styles.dayChipTemp}>{Math.round(d.tMax)}°</Text>
                <Text style={styles.dayChipMin}>{Math.round(d.tMin)}°</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {trip.weather.estimated && (
          <View style={styles.banner}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#a15c00" />
            <Text style={styles.bannerText}>
              Ces dates sont trop lointaines pour une prévision : la météo est estimée d'après les mêmes jours l'an dernier.
            </Text>
          </View>
        )}

        {trip.notes.map((n) => (
          <View key={n} style={styles.banner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#a15c00" />
            <Text style={styles.bannerText}>{n}</Text>
          </View>
        ))}

        {/* Progression */}
        <View style={styles.progressRow}>
          <Text style={styles.sectionTitle}>Dans la valise</Text>
          <Text style={styles.sub}>{packedCount} / {items.length} rangées</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${items.length ? (packedCount / items.length) * 100 : 0}%` }]} />
        </View>

        {items.length === 0 && (
          <Text style={styles.sub}>Aucun vêtement n'a pu être sélectionné. Ajoute des pièces dans ton dressing.</Text>
        )}

        {PACK_ORDER.map((type) => {
          const group = items.filter((i) => i.type === type);
          if (group.length === 0) return null;
          return (
            <View key={type} style={styles.group}>
              <Text style={styles.groupTitle}>{typePlural(type)} ({group.length})</Text>
              {group.map((item) => {
                const packed = trip.packed.includes(item.id);
                return (
                  <Pressable key={item.id} style={[styles.row, packed && styles.rowPacked]} onPress={() => onTogglePacked(item.id)}>
                    <Image source={{ uri: item.uri }} style={styles.img} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{typeSingular(item.type)}</Text>
                      <View style={styles.dots}>
                        {allColors(item).map((c) => (
                          <View key={c} style={[styles.dot, { backgroundColor: COLOR_HEX[c] }]} />
                        ))}
                        {!item.clean && <Text style={styles.dirty}>à laver avant de partir</Text>}
                      </View>
                    </View>
                    <MaterialCommunityIcons
                      name={packed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={26}
                      color={packed ? '#2E8B57' : '#999'}
                    />
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {/* Tenues jour par jour */}
        <Text style={styles.sectionTitle}>Jour par jour</Text>
        {trip.dayOutfits.map((d, index) => {
          const pieces = d.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => !!i);
          const w = days[index];
          return (
            <View key={d.date} style={styles.dayCard}>
              <View style={styles.dayCardHeader}>
                <Text style={styles.dayCardTitle}>{formatShort(d.date)}</Text>
                {w && (
                  <View style={styles.dayCardWeather}>
                    <MaterialCommunityIcons name={weatherIcon(w)} size={18} color="#444" />
                    <Text style={styles.sub}>{Math.round(w.tMin)}° / {Math.round(w.tMax)}°</Text>
                  </View>
                )}
              </View>
              <View style={styles.pieces}>
                {pieces.map((p) => (
                  <Image key={p.id} source={{ uri: p.uri }} style={styles.pieceImg} />
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.actions}>
          <Pressable style={styles.btn} onPress={onRegenerate}>
            <MaterialCommunityIcons name="autorenew" size={18} color="#fff" />
            <Text style={styles.btnText}>Autre sélection</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={confirmDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#C62828" />
            <Text style={[styles.btnText, { color: '#C62828' }]}>Supprimer</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 20, gap: 12, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { color: '#666', textTransform: 'capitalize' },
  weatherCard: { backgroundColor: '#e8f1ff', borderRadius: 16, padding: 16, gap: 4 },
  range: { fontSize: 32, fontWeight: '700' },
  rainText: { color: '#444' },
  dayStrip: { gap: 8, paddingTop: 10 },
  dayChip: { alignItems: 'center', gap: 2, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, minWidth: 58 },
  dayChipDate: { fontSize: 11, color: '#666' },
  dayChipTemp: { fontWeight: '700' },
  dayChipMin: { fontSize: 12, color: '#888' },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#fff3df', borderRadius: 12, padding: 12 },
  bannerText: { flex: 1, color: '#7a4600', fontSize: 13 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginTop: 8 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#e5e5e5', overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#2E8B57' },
  group: { gap: 8, marginTop: 4 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#444' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f6f6f6', borderRadius: 14, padding: 8 },
  rowPacked: { opacity: 0.55 },
  img: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#e5e5e5' },
  rowInfo: { flex: 1, gap: 4 },
  rowName: { fontSize: 16, fontWeight: '600' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#ccc' },
  dirty: { color: '#a15c00', fontSize: 12, marginLeft: 4 },
  dayCard: { backgroundColor: '#f6f6f6', borderRadius: 14, padding: 12, gap: 8 },
  dayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardTitle: { fontWeight: '700', textTransform: 'capitalize' },
  dayCardWeather: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pieces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pieceImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#e5e5e5' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#222', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  btnGhost: { backgroundColor: '#eee' },
  btnText: { color: '#fff', fontWeight: '600' },
});