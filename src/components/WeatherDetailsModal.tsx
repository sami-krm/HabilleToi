import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { ListRow } from '@/components/ListRow';
import { Palette } from '@/constants/theme';
import { weatherVisual } from '@/services/weatherIcon';
import type { Weather } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  weather: Weather;
  unit: 'C' | 'F';
  advice: string;
}

// Pastilles colorées des lignes météo
const TINTS = { temperature: '#A8735A', feels: '#EC4899', rain: '#3B82F6', wind: '#1FBF8F', advice: '#7C5CFF' };

/** Fiche « Plus d'infos » : le détail de la météo du jour sélectionné. */
export default function WeatherDetailsModal({ visible, onClose, weather, unit, advice }: Props) {
  const toUnit = (t: number) => Math.round(unit === 'F' ? t * 9 / 5 + 32 : t);
  const visual = weatherVisual(weather.weatherCode, weather.isDay ?? true);
  const low = weather.minTemperature ?? weather.temperature;
  const high = weather.maxTemperature ?? weather.temperature;
  const feels = weather.apparentTemperature ?? weather.temperature;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <AuroraScreen variant="hero">
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Plus d’infos</Text>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8} accessibilityLabel="Fermer">
            <MaterialCommunityIcons name="close" size={22} color={Palette.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.hero}>
            <MaterialCommunityIcons name={visual.name} size={56} color={Palette.white} />
            <Text style={styles.heroTemp}>{toUnit(weather.temperature)}°{unit}</Text>
            <Text style={styles.heroLabel}>{weather.city?.split(',')[0] ?? 'Ma position'} · {visual.label}</Text>
          </View>

          <View style={styles.card}>
            <ListRow icon="thermometer" tint={TINTS.temperature} title="Températures" subtitle="Matin · après-midi"
              value={`${toUnit(low)}° / ${toUnit(high)}°`} />
            <ListRow icon="account-outline" tint={TINTS.feels} title="Ressenti" subtitle="Avec le vent et l’humidité"
              value={`${toUnit(feels)}°`} />
            <ListRow icon="weather-pouring" tint={TINTS.rain} title="Pluie"
              subtitle={weather.rainTime ? `Vers ${weather.rainTime}` : 'Pas de pluie prévue'} value={`${weather.precipitation} mm`} />
            <ListRow icon="weather-windy" tint={TINTS.wind} title="Vent"
              subtitle={weather.windSpeed > 30 ? 'Fort, couvre-toi' : 'Calme'} value={`${Math.round(weather.windSpeed)} km/h`} />
          </View>

          <View style={styles.card}>
            <ListRow icon="lightbulb-on" tint={TINTS.advice} title="Conseil du jour" subtitle={advice} />
          </View>
        </ScrollView>
      </AuroraScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  headerSpacer: { width: 40 },
  headerTitle: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  hero: { alignItems: 'center', gap: 4, paddingVertical: 28 },
  heroTemp: { color: Palette.white, fontSize: 64, lineHeight: 72, fontWeight: '700', letterSpacing: -1.5 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '500' },
  card: { backgroundColor: Palette.surface, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 8 },
});
