import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, SafeAreaView, StyleSheet, Switch, Text, View,
} from 'react-native';

import {
  cancelMorningReminders, ensureNotificationPermission, ReminderError, scheduleMorningReminders, sendTestReminder,
} from '@/services/morningReminder';
import { DEFAULT_REMINDER, loadReminderSettings, saveReminderSettings } from './reminderSettings';
import type { ReminderSettings } from './reminderSettings';

const formatTime = (h: number, m: number) => `${h} h ${String(m).padStart(2, '0')}`;

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Fenêtre de réglage du rappel du matin : interrupteur, heure, essai. */
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

  // Décale l'heure en minutes, en restant dans la même journée
  const shift = (deltaMinutes: number) =>
    setDraft((d) => {
      const total = (((d.hour * 60 + d.minute + deltaMinutes) % 1440) + 1440) % 1440;
      return { ...d, hour: Math.floor(total / 60), minute: total % 60 };
    });

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
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color="#222" />
            </Pressable>
            <Text style={styles.title}>Rappel du matin</Text>
          </View>

          <Text style={styles.sub}>
            Chaque matin, une notification te donne la météo du jour et te dit que ta tenue est prête.
            Les prévisions sont remises à jour à chaque ouverture de l'app : ouvre-la au moins une fois tous les 14 jours.
          </Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Recevoir le rappel</Text>
            <Switch value={draft.enabled} onValueChange={(enabled) => setDraft((d) => ({ ...d, enabled }))} />
          </View>

          <View style={[styles.timeBox, !draft.enabled && styles.disabled]} pointerEvents={draft.enabled ? 'auto' : 'none'}>
            <Text style={styles.time}>{formatTime(draft.hour, draft.minute)}</Text>
            <View style={styles.stepper}>
              {[
                { label: '−1 h', delta: -60 },
                { label: '−15 min', delta: -15 },
                { label: '+15 min', delta: 15 },
                { label: '+1 h', delta: 60 },
              ].map((s) => (
                <Pressable key={s.label} style={styles.stepBtn} onPress={() => shift(s.delta)}>
                  <Text style={styles.stepText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {draft.enabled && (
            <Pressable style={styles.testBtn} onPress={test} disabled={busy}>
              <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#222" />
              <Text style={styles.testText}>Envoyer une notification d'essai</Text>
            </Pressable>
          )}

          {status && <Text style={styles.status}>{status}</Text>}
        </View>

        <View style={styles.footer}>
          <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Enregistrer</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { color: '#666', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f6f6f6', borderRadius: 14, padding: 16,
  },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  timeBox: { alignItems: 'center', gap: 12, backgroundColor: '#e8f1ff', borderRadius: 16, padding: 20 },
  disabled: { opacity: 0.4 },
  time: { fontSize: 44, fontWeight: '700' },
  stepper: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  stepBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  stepText: { fontWeight: '700', color: '#222' },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#eee', borderRadius: 12, paddingVertical: 14,
  },
  testText: { fontWeight: '600', color: '#222' },
  status: { color: '#444' },
  footer: { padding: 20 },
  primary: { backgroundColor: '#222', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: '#bbb' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});