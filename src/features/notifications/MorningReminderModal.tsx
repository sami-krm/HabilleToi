import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { Glass, Palette } from '@/constants/theme';
import {
  cancelMorningReminders, ensureNotificationPermission, ReminderError, scheduleMorningReminders, sendTestReminder,
} from '@/services/morningReminder';
import type { ReminderSettings } from './reminderSettings';
import { DEFAULT_REMINDER, loadReminderSettings, saveReminderSettings } from './reminderSettings';

const formatTime = (h: number, m: number) => `${h} h ${String(m).padStart(2, '0')}`;

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Fenêtre de réglage du rappel du matin : interrupteur, heure (molettes), essai. */
export default function MorningReminderModal({ visible, onClose }: Props) {
  const [draft, setDraft] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Recharge les réglages enregistrés à chaque ouverture
  useEffect(() => {
    if (!visible) return;
    setStatus(null);
    loadReminderSettings().then(setDraft);
  }, [visible]);

  // Le sélecteur travaille avec une date : on y place l'heure choisie
  const timeValue = useMemo(() => {
    const d = new Date();
    d.setHours(draft.hour, draft.minute, 0, 0);
    return d;
  }, [draft.hour, draft.minute]);

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed' || !date) return;
    setDraft((d) => ({ ...d, hour: date.getHours(), minute: date.getMinutes() }));
  };

  // Android : le sélecteur s'ouvre dans une fenêtre système
  const openAndroidPicker = () =>
    DateTimePickerAndroid.open({ value: timeValue, mode: 'time', is24Hour: true, onChange: onTimeChange });

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await task();
    } catch (e) {
      setStatus(e instanceof ReminderError ? e.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const askSettings = () =>
    Alert.alert(
      'Notifications désactivées',
      'Autorise les notifications pour cette app dans les réglages du téléphone.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() },
      ],
    );

  const save = () =>
    run(async () => {
      if (!draft.enabled) {
        await cancelMorningReminders();
        await saveReminderSettings(draft);
        setStatus('Rappel désactivé.');
        return;
      }
      if (!(await ensureNotificationPermission())) {
        setDraft((d) => ({ ...d, enabled: false }));
        askSettings();
        return;
      }
      await saveReminderSettings(draft);
      const count = await scheduleMorningReminders(draft);
      setStatus(`C'est réglé : rappel à ${formatTime(draft.hour, draft.minute)}, ${count} matin${count > 1 ? 's' : ''} programmé${count > 1 ? 's' : ''}.`);
    });

  const test = () =>
    run(async () => {
      if (!(await ensureNotificationPermission())) {
        askSettings();
        return;
      }
      await sendTestReminder();
      setStatus("Notification d'essai envoyée : elle arrive dans 5 secondes. Pour la voir comme le matin, quitte l'app.");
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <AuroraScreen>
        <View style={styles.body}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color={Palette.text} />
            </Pressable>
            <Text style={styles.title}>Rappel du matin</Text>
          </View>

          <Text style={styles.sub}>
            Chaque matin, une notification te donne la météo du jour et te dit que ta tenue est prête.
            Les prévisions sont remises à jour à chaque ouverture de l'app : ouvre-la au moins une fois tous les 14 jours.
          </Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Recevoir le rappel</Text>
            <Switch
              value={draft.enabled}
              onValueChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
              trackColor={{ false: Palette.hairline, true: Palette.accent }}
            />
          </View>

          {/* Heure : molettes comme les réveils de l'iPhone */}
          <View style={[styles.timeBox, !draft.enabled && styles.disabled]} pointerEvents={draft.enabled ? 'auto' : 'none'}>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={timeValue}
                mode="time"
                display="spinner"
                locale="fr-FR"
                themeVariant="light"
                textColor={Palette.text}
                onChange={onTimeChange}
                style={styles.picker}
              />
            ) : (
              <Pressable onPress={openAndroidPicker} style={styles.androidTime}>
                <Text style={styles.time}>{formatTime(draft.hour, draft.minute)}</Text>
                <Text style={styles.timeHint}>Touche pour changer l'heure</Text>
              </Pressable>
            )}
          </View>

          {draft.enabled && (
            <Pressable style={styles.testBtn} onPress={test} disabled={busy}>
              <MaterialCommunityIcons name="bell-ring-outline" size={18} color={Palette.accent} />
              <Text style={styles.testText}>Envoyer une notification d'essai</Text>
            </Pressable>
          )}

          {status && <Text style={styles.status}>{status}</Text>}
        </View>

        <View style={styles.footer}>
          <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color={Palette.onAccent} /> : <Text style={styles.primaryText}>Enregistrer</Text>}
          </Pressable>
        </View>
      </AuroraScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: Palette.text },
  sub: { color: Palette.textSecondary, fontSize: 15 },
  row: {
    ...Glass, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, padding: 16,
  },
  rowLabel: { fontSize: 16, fontWeight: '600', color: Palette.text },
  timeBox: { ...Glass, borderRadius: 24, paddingVertical: 4, overflow: 'hidden' },
  disabled: { opacity: 0.4 },
  picker: { height: 200 },
  androidTime: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  time: { fontSize: 44, fontWeight: '800', color: Palette.text },
  timeHint: { color: Palette.textSecondary, fontSize: 13 },
  testBtn: {
    ...Glass, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
  },
  testText: { fontWeight: '600', color: Palette.text },
  status: { color: Palette.textSecondary },
  footer: { padding: 20 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: Palette.surfaceSelected, opacity: 0.55 },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
});