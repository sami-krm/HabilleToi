import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Slider } from '@expo/ui/community/slider';
import {
  Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useEffect, useState } from 'react';

import AuroraScreen from '@/components/AuroraScreen';
import { GlassCard } from '@/components/GlassCard';
import { STYLE_OPTIONS } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import type { Profile } from '@/hooks/useProfile';
import { exportBackup, importBackup, clearUserData } from '@/services/backupService';
import { DEFAULT_LAUNDRY, loadLaundryThresholds, saveLaundryThresholds } from '@/storage/preferences';
import { enableCalendarAccess } from '@/services/calendarOccasion';
import type { ClothingType } from '@/types';
import { AGE_OPTIONS, CHANNEL_OPTIONS, GENDER_OPTIONS, loadProfile, saveProfile as saveQuestionnaire, OCCUPATION_OPTIONS, SHOPS, type UserProfile } from '@/features/onboarding/profile';
import MorningReminderModal from '@/features/notifications/MorningReminderModal';
import WeeklyPlanModal from '@/components/WeeklyPlanModal';
import CloudSyncModal from '@/components/CloudSyncModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  onDataRestored?: () => void;
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

export default function ProfileModal({ visible, onClose, profile, update, onDataRestored = () => {} }: Props) {
  const [questionnaire, setQuestionnaire] = useState<UserProfile>({ onboardingDone: false });
  const [thresholds, setThresholds] = useState(DEFAULT_LAUNDRY);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    loadProfile().then((value) => value && setQuestionnaire(value));
    loadLaundryThresholds().then(setThresholds);
  }, [visible]);

  const doExport = async () => {
    try {
      setBusy(true); await exportBackup();
      Alert.alert('Sauvegarde prête', Platform.OS === 'android'
        ? 'Le fichier a été créé dans le dossier que tu as choisi.'
        : 'Le fichier est dans Fichiers > Sur mon iPhone > Tenue du jour. Tu peux le déplacer vers iCloud Drive.');
    }
    catch { Alert.alert('Export impossible', 'La sauvegarde n’a pas pu être créée.'); }
    finally { setBusy(false); }
  };
  const doImport = () => Alert.alert('Restaurer une sauvegarde ?', 'Les données actuelles seront remplacées par celles du fichier choisi.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Choisir un fichier', onPress: async () => {
      try { setBusy(true); const count = await importBackup(); if (count) Alert.alert('Restauration terminée', `${count} éléments restaurés. Ferme puis rouvre l’app pour actualiser les écrans.`); }
      catch (error) { Alert.alert('Import impossible', error instanceof Error ? error.message : 'Le fichier n’a pas pu être restauré.'); }
      finally { setBusy(false); }
    } },
  ]);
  const doClear = () => Alert.alert('Supprimer toutes les données ?', 'Cette action efface le dressing, les favoris, l’historique et le profil de ce téléphone.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Tout supprimer', style: 'destructive', onPress: async () => { await clearUserData(); Alert.alert('Données supprimées', 'Redémarre l’app pour recommencer.'); onClose(); } },
  ]);
  const thresholdNames: [ClothingType, string][] = [
    ['tshirt', 'T-shirt'], ['chemise', 'Chemise'], ['pull', 'Pull'],
    ['veste', 'Veste'], ['veste_legere', 'Veste légère'], ['veste_epaisse', 'Veste chaude'],
    ['pantalon', 'Jean / pantalon'], ['short', 'Short'], ['jupe', 'Jupe'], ['robe', 'Robe'],
    ['chaussures', 'Chaussures'], ['echarpe', 'Écharpe'], ['bonnet', 'Bonnet'], ['parapluie', 'Parapluie'],
  ];
  const patchQuestionnaire = (patch: Partial<UserProfile>) => {
    const next = { ...questionnaire, ...patch };
    setQuestionnaire(next);
    saveQuestionnaire(next).catch(() => {});
  };
  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!res.canceled) update({ avatar: res.assets[0].uri });
  };
  const toggleCalendar = async (enabled: boolean) => {
    if (!enabled) {
      update({ calendarEnabled: false });
      return;
    }
    try {
      if (await enableCalendarAccess()) update({ calendarEnabled: true });
      else Alert.alert('Accès refusé', 'Autorise le calendrier dans les réglages pour détecter l’occasion de ta journée.');
    } catch {
      Alert.alert('Calendrier indisponible', 'Impossible de demander l’accès au calendrier sur cet appareil.');
    }
  };

  return (
    <>
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
              options={STYLE_OPTIONS}
              value={profile.style}
              onChange={(style) => update({ style })}
            />

            <Text style={styles.label}>Sensibilité au froid</Text>
            <View style={styles.sliderLabels}><Text style={styles.sliderLabel}>Je suis frileux</Text><Text style={styles.sliderLabel}>Je n’ai jamais froid</Text></View>
            <Slider
              minimumValue={-1}
              maximumValue={1}
              step={1}
              value={profile.cold === 'frileux' ? -1 : profile.cold === 'chaud' ? 1 : 0}
              minimumTrackTintColor={Palette.accent}
              onValueChange={(value) => {
                const cold = value < 0 ? 'frileux' : value > 0 ? 'chaud' : 'normal';
                if (cold !== profile.cold) update({ cold });
              }}
            />
            <Text style={styles.helperText}>{profile.cold === 'normal' ? 'Sensibilité normale' : profile.cold === 'frileux' ? 'Les tenues seront plus chaudes' : 'Les tenues seront plus légères'}</Text>

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

            <Text style={styles.sectionTitle}>Questionnaire</Text>
            <Text style={styles.label}>Situation</Text>
            <Chips options={OCCUPATION_OPTIONS} value={questionnaire.occupation ?? 'autre'} onChange={(occupation) => {
              patchQuestionnaire({ occupation });
              if (occupation === 'salarie') update({ style: 'formel' });
            }} />
            <Text style={styles.label}>Genre</Text>
            <Chips options={GENDER_OPTIONS} value={questionnaire.gender ?? 'autre'} onChange={(gender) => patchQuestionnaire({ gender})} />
            <Text style={styles.label}>Tranche d’âge</Text>
            <Chips options={AGE_OPTIONS} value={questionnaire.ageRange ?? '25-34'} onChange={(ageRange) => patchQuestionnaire({ ageRange })} />
            <Text style={styles.label}>Pays</Text>
            <TextInput style={styles.input} value={questionnaire.country ?? ''} onChangeText={(country) => {
              patchQuestionnaire({ country });
            }} placeholder="France" placeholderTextColor={Palette.textSecondary} />
            <Text style={styles.label}>Où commandes-tu ?</Text>
            <View style={styles.chips}>{CHANNEL_OPTIONS.map((option) => {
              const selected = questionnaire.channels?.includes(option.key) ?? false;
              return <Pressable key={option.key} style={[styles.chip, selected && styles.chipOn]} onPress={() => patchQuestionnaire({ channels: selected ? questionnaire.channels?.filter((item) => item !== option.key) : [...(questionnaire.channels ?? []), option.key] })}><Text style={selected ? styles.chipTextOn : styles.chipText}>{option.label}</Text></Pressable>;
            })}</View>
            <Text style={styles.label}>Boutiques préférées</Text>
            <View style={styles.chips}>{SHOPS.map((shop) => {
              const selected = questionnaire.shops?.includes(shop.id) ?? false;
              return <Pressable key={shop.id} style={[styles.chip, selected && styles.chipOn]} onPress={() => patchQuestionnaire({ shops: selected ? questionnaire.shops?.filter((id) => id !== shop.id) : [...(questionnaire.shops ?? []), shop.id] })}><Text style={selected ? styles.chipTextOn : styles.chipText}>{shop.name}</Text></Pressable>;
            })}</View>

            <Text style={styles.sectionTitle}>Lavage automatique</Text>
            <Text style={styles.helper}>Marquer une pièce au sale après ce nombre de ports.</Text>
            {thresholdNames.map(([type, label]) => <View key={type} style={styles.thresholdRow}>
              <Text style={styles.thresholdLabel}>{label}</Text>
              <Pressable style={styles.stepper} onPress={() => { const next = { ...thresholds, [type]: Math.max(1, thresholds[type] - 1) }; setThresholds(next); saveLaundryThresholds(next).catch(() => {}); }}><Text style={styles.stepText}>−</Text></Pressable>
              <Text style={styles.thresholdValue}>{thresholds[type]} port{thresholds[type] > 1 ? 's' : ''}</Text>
              <Pressable style={styles.stepper} onPress={() => { const next = { ...thresholds, [type]: Math.min(30, thresholds[type] + 1) }; setThresholds(next); saveLaundryThresholds(next).catch(() => {}); }}><Text style={styles.stepText}>+</Text></Pressable>
            </View>)}

            <Text style={styles.sectionTitle}>Rappels et données</Text>
            <View style={styles.switchRow}>
              <View style={styles.calendarCopy}>
                <Text style={styles.label}>Adapter la tenue à mon calendrier</Text>
                <Text style={styles.helper}>Les titres d’événements sont lus sur cet appareil.</Text>
              </View>
              <Switch value={profile.calendarEnabled} onValueChange={toggleCalendar} />
            </View>
            <Pressable style={styles.actionButton} onPress={() => setWeeklyOpen(true)}><MaterialCommunityIcons name="calendar-week" size={19} color={Palette.accent} /><Text style={styles.actionText}>Voir mon planning de la semaine</Text></Pressable>
            <Pressable style={styles.actionButton} onPress={() => setReminderOpen(true)}><MaterialCommunityIcons name="bell-outline" size={19} color={Palette.accent} /><Text style={styles.actionText}>Heure du rappel du matin</Text></Pressable>
            <Pressable style={styles.actionButton} onPress={() => setCloudOpen(true)}><MaterialCommunityIcons name="cloud-sync-outline" size={19} color={Palette.accent} /><Text style={styles.actionText}>Synchronisation en ligne</Text></Pressable>
            <Pressable style={styles.actionButton} onPress={doExport} disabled={busy}><MaterialCommunityIcons name="cloud-upload-outline" size={19} color={Palette.accent} /><Text style={styles.actionText}>Sauvegarder dans Fichiers / iCloud</Text></Pressable>
            <Pressable style={styles.actionButton} onPress={doImport} disabled={busy}><MaterialCommunityIcons name="backup-restore" size={19} color={Palette.accent} /><Text style={styles.actionText}>Restaurer une sauvegarde</Text></Pressable>
            <Pressable style={styles.dangerButton} onPress={doClear}><MaterialCommunityIcons name="delete-outline" size={19} color={Palette.danger} /><Text style={styles.dangerText}>Supprimer toutes mes données</Text></Pressable>
          </GlassCard>
        </ScrollView>
      </AuroraScreen>
    </Modal>
    <MorningReminderModal visible={reminderOpen} onClose={() => setReminderOpen(false)} />
    <WeeklyPlanModal visible={weeklyOpen} onClose={() => setWeeklyOpen(false)} />
    <CloudSyncModal visible={cloudOpen} onClose={() => setCloudOpen(false)} onRestored={onDataRestored} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 60 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: Palette.text, letterSpacing: -0.4 },
  avatarWrap: {
    alignSelf: 'center', width: 96, height: 96, borderRadius: 48, overflow: 'hidden',
    backgroundColor: Palette.surfaceRaised, alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 96, height: 96 },
  card: { gap: 10 },
  label: { fontWeight: '700', color: Palette.text, marginTop: 6 },
  input: {
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Palette.surfaceRaised, color: Palette.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: Palette.surfaceRaised },
  chipOn: { backgroundColor: Palette.ink },
  chipText: { color: Palette.textSecondary, fontWeight: '700' },
  chipTextOn: { color: Palette.onAccent, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calendarCopy: { flex: 1, paddingRight: 12 },
  sectionTitle: { color: Palette.text, fontWeight: '800', fontSize: 18, marginTop: 14 },
  helper: { color: Palette.textSecondary, fontSize: 13 },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  thresholdLabel: { flex: 1, color: Palette.text, fontWeight: '600' },
  stepper: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: Palette.text, fontSize: 20, fontWeight: '700' },
  thresholdValue: { color: Palette.textSecondary, minWidth: 66, textAlign: 'center', fontSize: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  actionText: { color: Palette.text, fontWeight: '600', flex: 1 },
  dangerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dangerText: { color: Palette.danger, fontWeight: '700' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sliderLabel: { color: Palette.textSecondary, fontSize: 12, fontWeight: '600' },
  helperText: { color: Palette.textSecondary, fontSize: 12, textAlign: 'center' },
});
