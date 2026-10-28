import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { GlassCard } from '@/components/GlassCard';
import { Palette } from '@/constants/theme';
import {
  createCloudAccount, getCloudSession, isCloudSyncConfigured, restoreCloudBackup,
  saveCloudBackup, signInCloudAccount, signOutCloudAccount, type CloudSession,
} from '@/services/cloudSync';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export default function CloudSyncModal({ visible, onClose, onRestored }: Props) {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    getCloudSession().then(setSession).catch(() => setSession(null));
  }, [visible]);

  const runAuth = async (mode: 'signup' | 'signin') => {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = mode === 'signup'
        ? await createCloudAccount(email, password)
        : await signInCloudAccount(email, password);
      if (next) {
        setSession(next); setPassword('');
        setMessage(mode === 'signup' ? 'Compte créé. La sauvegarde est prête à être synchronisée.' : 'Connexion réussie.');
      } else {
        setMessage('Compte créé. Consulte ta boîte mail pour confirmer ton adresse, puis connecte-toi.');
        setPassword('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally { setBusy(false); }
  };

  const upload = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await saveCloudBackup(); setMessage('Sauvegarde envoyée avec le dressing, les photos, les favoris et l’historique.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sauvegarde impossible.'); }
    finally { setBusy(false); }
  };

  const restore = () => Alert.alert(
    'Remplacer les données de ce téléphone ?',
    'La sauvegarde en ligne remplacera le dressing, les préférences, les favoris et l’historique locaux.',
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Restaurer', style: 'destructive', onPress: async () => {
        setBusy(true); setError(''); setMessage('');
        try {
          const count = await restoreCloudBackup();
          setMessage(`${count} éléments restaurés. Les photos sont incluses.`);
          onRestored();
        } catch (e) { setError(e instanceof Error ? e.message : 'Restauration impossible.'); }
        finally { setBusy(false); }
      } },
    ],
  );

  const logout = async () => {
    await signOutCloudAccount();
    setSession(null); setMessage('Déconnexion effectuée.'); setError('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <AuroraScreen>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <View>
              <Text style={styles.title}>Synchronisation en ligne</Text>
              <Text style={styles.subtitle}>Retrouve ton dressing sur un autre téléphone.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
              <MaterialCommunityIcons name="close" size={26} color={Palette.text} />
            </Pressable>
          </View>

          <GlassCard style={styles.card}>
            {!isCloudSyncConfigured() ? (
              <Text style={styles.helper}>La connexion Supabase doit être configurée pour cette version de l’app.</Text>
            ) : session ? (
              <>
                <Text style={styles.label}>Connecté·e avec</Text>
                <Text style={styles.email}>{session.user.email}</Text>
                <Text style={styles.helper}>La sauvegarde contient les vêtements et photos, les favoris, l’historique et les préférences.</Text>
                <Pressable style={styles.button} onPress={upload} disabled={busy}>
                  {busy ? <ActivityIndicator color={Palette.onAccent} /> : <MaterialCommunityIcons name="cloud-upload-outline" size={19} color={Palette.onAccent} />}
                  <Text style={styles.buttonText}>Sauvegarder en ligne</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={restore} disabled={busy}>
                  <MaterialCommunityIcons name="backup-restore" size={19} color={Palette.accent} />
                  <Text style={styles.secondaryText}>Restaurer depuis le cloud</Text>
                </Pressable>
                <Pressable onPress={logout} disabled={busy}><Text style={styles.link}>Se déconnecter</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Adresse e-mail</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="toi@exemple.fr" placeholderTextColor={Palette.textSecondary} />
                <Text style={styles.label}>Mot de passe</Text>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" placeholder="8 caractères minimum" placeholderTextColor={Palette.textSecondary} />
                <Pressable style={styles.button} onPress={() => runAuth('signin')} disabled={busy || !email.trim() || password.length < 8}>
                  {busy ? <ActivityIndicator color={Palette.onAccent} /> : <MaterialCommunityIcons name="login" size={19} color={Palette.onAccent} />}
                  <Text style={styles.buttonText}>Se connecter</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => runAuth('signup')} disabled={busy || !email.trim() || password.length < 8}>
                  <MaterialCommunityIcons name="account-plus-outline" size={19} color={Palette.accent} />
                  <Text style={styles.secondaryText}>Créer un compte</Text>
                </Pressable>
              </>
            )}
            {!!message && <Text style={styles.message}>{message}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </GlassCard>
        </ScrollView>
      </AuroraScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 50 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  title: { color: Palette.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: Palette.textSecondary, marginTop: 4 },
  card: { gap: 12 },
  label: { color: Palette.text, fontWeight: '700' },
  email: { color: Palette.text, fontSize: 16, fontWeight: '700' },
  helper: { color: Palette.textSecondary, lineHeight: 20 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.65)', color: Palette.text },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 16, backgroundColor: Palette.ink },
  buttonText: { color: Palette.onAccent, fontWeight: '800' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.55)' },
  secondaryText: { color: Palette.accent, fontWeight: '700' },
  link: { color: Palette.accent, fontWeight: '700', alignSelf: 'center', padding: 8 },
  message: { color: Palette.accent, lineHeight: 20 },
  error: { color: Palette.danger, lineHeight: 20 },
});
