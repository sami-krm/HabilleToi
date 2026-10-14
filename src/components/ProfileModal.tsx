import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { GlassCard } from '@/components/GlassCard';
import { Palette } from '@/constants/theme';
import type { Profile } from '@/hooks/useProfile';

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
}

function Chips<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[styles.chip, value === o.key && styles.chipOn]}
        >
          <Text style={value === o.key ? styles.chipTextOn : styles.chipText}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ProfileModal({ visible, onClose, profile, update }: Props) {
  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!res.canceled) update({ avatar: res.assets[0].uri });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <AuroraScreen>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topRow}>
            <Text style={styles.title}>Mon profil</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
              <MaterialCommunityIcons name="close" size={26} color={Palette.text} />
            </Pressable>
          </View>

          <Pressable onPress={pickAvatar} style={styles.avatarWrap} accessibilityLabel="Changer la photo">
            {profile.avatar
              ? <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              : <MaterialCommunityIcons name="camera-plus-outline" size={32} color={Palette.textSecondary} />}
          </Pressable>

          <GlassCard style={styles.card}>
            <Text style={styles.label}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              onChangeText={(name) => update({ name })}
              placeholder="Ton prénom"
              placeholderTextColor={Palette.textSecondary}
            />

            <Text style={styles.label}>Style préféré</Text>
            <Chips
              options={[
                { key: 'casual', label: 'Casual' },
                { key: 'sport', label: 'Sport' },
                { key: 'formel', label: 'Formel' },
                { key: 'soiree', label: 'Soirée' },
              ]}
              value={profile.style}
              onChange={(style) => update({ style })}
            />

            <Text style={styles.label}>Sensibilité au froid</Text>
            <Chips
              options={[
                { key: 'frileux', label: 'Frileux' },
                { key: 'normal', label: 'Normal' },
                { key: 'chaud', label: 'Chaud' },
              ]}
              value={profile.cold}
              onChange={(cold) => update({ cold })}
            />

            <Text style={styles.label}>Unité de température</Text>
            <Chips
              options={[{ key: 'C', label: '°C' }, { key: 'F', label: '°F' }]}
              value={profile.unit}
              onChange={(unit) => update({ unit })}
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Notifications</Text>
              <Switch
                value={profile.notifications}
                onValueChange={(notifications) => update({ notifications })}
              />
            </View>
          </GlassCard>
        </ScrollView>
      </AuroraScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 60 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: Palette.text, letterSpacing: -0.4 },
  avatarWrap: {
    alignSelf: 'center', width: 96, height: 96, borderRadius: 48, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 96, height: 96 },
  card: { gap: 10 },
  label: { fontWeight: '700', color: Palette.text, marginTop: 6 },
  input: {
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.55)', color: Palette.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.55)' },
  chipOn: { backgroundColor: Palette.ink },
  chipText: { color: Palette.textSecondary, fontWeight: '700' },
  chipTextOn: { color: Palette.onAccent, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});