import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AuroraScreen from '@/components/AuroraScreen';
import { Palette } from '@/constants/theme';
import { useProfile } from '@/hooks/useProfile';
import { loadHistory, loadWardrobe } from '@/storage/wardrobeStorage';
import { generateOutfit, outfitSignature } from '@/services/outfitGenerator';
import { getCurrentWeather } from '@/services/weatherService';
import type { Outfit, Weather } from '@/types';

interface PlanDay { date: string; weather: Weather; outfit: Outfit | null }

export default function WeeklyPlanModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [days, setDays] = useState<PlanDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { profile } = useProfile();
  useEffect(() => {
    if (!visible) return;
    let active = true;
    Promise.resolve().then(() => { setLoading(true); setError(''); }).then(() => Promise.all([loadWardrobe(), loadHistory()])).then(async ([wardrobe, history]) => {
      const generated: PlanDay[] = [];
      const used = new Set<string>();
      for (let offset = 0; offset < 7; offset++) {
        const weather = await getCurrentWeather(offset);
        const weekday = new Date(`${weather.date}T12:00:00`).getDay();
        const style = profile.style === 'formel' ? (weekday >= 1 && weekday <= 5 ? 'formel' : 'casual') : profile.style;
        const outfit = generateOutfit(wardrobe, weather, style, used, history);
        if (outfit) used.add(outfitSignature(outfit.items));
        generated.push({ date: weather.date ?? '', weather, outfit });
      }
      if (active) setDays(generated);
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Prévisions indisponibles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, profile.style]);

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <AuroraScreen>
      <View style={styles.header}><Text style={styles.title}>Planning de la semaine</Text><Pressable onPress={onClose}><MaterialCommunityIcons name="close" size={26} color={Palette.text} /></Pressable></View>
      {loading ? <ActivityIndicator color={Palette.accent} style={styles.spinner} /> : error ? <Text style={styles.error}>{error}</Text> : <ScrollView contentContainerStyle={styles.list}>
        {days.map(({ date, weather, outfit }, index) => <View key={date || index} style={styles.card}>
          <View style={styles.dayRow}><Text style={styles.day}>{index === 0 ? "Aujourd'hui" : new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</Text><Text style={styles.temps}>{Math.round(weather.minTemperature ?? weather.temperature)}° / {Math.round(weather.maxTemperature ?? weather.temperature)}°</Text></View>
          {outfit ? <View style={styles.items}>{outfit.items.map((item) => <Image key={item.id} source={{ uri: item.uri }} style={styles.image} />)}</View> : <Text style={styles.empty}>Pas de tenue disponible pour cette météo.</Text>}
          {weather.rainTime && <Text style={styles.rain}>Pluie vers {weather.rainTime}</Text>}
        </View>)}
      </ScrollView>}
    </AuroraScreen>
  </Modal>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 54 },
  title: { color: Palette.text, fontSize: 23, fontWeight: '800' },
  spinner: { marginTop: 80 }, error: { margin: 24, color: Palette.textSecondary },
  list: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 18, padding: 14, gap: 10 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { color: Palette.text, fontWeight: '800', textTransform: 'capitalize' }, temps: { color: Palette.textSecondary, fontWeight: '700' },
  items: { flexDirection: 'row', gap: 8 }, image: { width: 58, height: 58, borderRadius: 12, backgroundColor: Palette.surfaceRaised },
  empty: { color: Palette.textSecondary }, rain: { color: Palette.accent, fontWeight: '700', fontSize: 12 },
});
