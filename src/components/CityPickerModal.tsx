import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AuroraScreen from '@/components/AuroraScreen';
import { Palette } from '@/constants/theme';
import { searchCities, type SavedLocation } from '@/services/weatherService';

export default function CityPickerModal({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (location: SavedLocation | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<SavedLocation[]>([]);
  useEffect(() => {
    let active = true;
    if (query.trim().length < 2) {
      const timer = setTimeout(() => setCities([]), 0);
      return () => { active = false; clearTimeout(timer); };
    }
    const timer = setTimeout(() => searchCities(query).then((result) => { if (active) setCities(result); }).catch(() => { if (active) setCities([]); }), 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setQuery(''), 0);
    return () => clearTimeout(timer);
  }, [visible]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <AuroraScreen><View style={styles.body}>
      <View style={styles.header}><Text style={styles.title}>Choisir une ville</Text><Pressable onPress={onClose}><MaterialCommunityIcons name="close" size={26} color={Palette.text} /></Pressable></View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Paris, Lyon…" placeholderTextColor={Palette.textSecondary} style={styles.input} autoFocus />
      <ScrollView keyboardShouldPersistTaps="handled">
        <Pressable style={styles.row} onPress={() => onSelect(null)}><MaterialCommunityIcons name="crosshairs-gps" size={20} color={Palette.accent} /><Text style={styles.result}>Utiliser ma position</Text></Pressable>
        {cities.map((city) => <Pressable key={`${city.latitude}-${city.longitude}`} style={styles.row} onPress={() => onSelect(city)}><MaterialCommunityIcons name="map-marker-outline" size={20} color={Palette.accent} /><Text style={styles.result}>{city.name}</Text></Pressable>)}
      </ScrollView>
    </View></AuroraScreen>
  </Modal>;
}
const styles = StyleSheet.create({
  body: { flex: 1, padding: 22, paddingTop: 56, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Palette.text, fontWeight: '800', fontSize: 24 },
  input: { backgroundColor: Palette.surfaceRaised, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: Palette.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  result: { color: Palette.text, fontWeight: '600', flex: 1 },
});
