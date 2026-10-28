import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import AuroraScreen from '@/components/AuroraScreen';
import { Palette } from '@/constants/theme';
import {
  createCloudAccount, isCloudSyncConfigured, restoreCloudBackup, signInCloudAccount,
} from '@/services/cloudSync';

export type AuthMode = 'signup' | 'login';

interface Props {
  initialMode?: AuthMode;
  /** restored = une sauvegarde en ligne a remplacé les données du téléphone. */
  onDone: (result: { restored: boolean }) => void;
  onSkip: () => void;
  onBack?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** Inscription ou connexion par e-mail (compte Supabase), avec possibilité de continuer sans compte. */
export default function AuthScreen({ initialMode = 'signup', onDone, onSkip, onBack }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const configured = isCloudSyncConfigured();

  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = password.length >= MIN_PASSWORD;
  const canSubmit = configured && emailOk && passwordOk && !busy;

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        const session = await createCloudAccount(email, password);
        if (!session) {
          // Le projet demande de confirmer l'adresse avant la première connexion
          setInfo('Compte créé ! Confirme ton adresse depuis l’e-mail reçu, puis connecte-toi.');
          setMode('login');
          return;
        }
        onDone({ restored: false });
      } else {
        await signInCloudAccount(email, password);
        // Ancien utilisateur : on récupère sa sauvegarde s'il en a une
        const restored = await restoreCloudBackup().then(() => true).catch(() => false);
        onDone({ restored });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuroraScreen variant="hero">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable style={styles.iconBtn} onPress={onBack} hitSlop={8} accessibilityLabel="Retour">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Palette.white} />
            </Pressable>
          ) : <View style={styles.iconSpacer} />}
          <Pressable onPress={onSkip} hitSlop={10}>
            <Text style={styles.skip}>Plus tard</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Animated.View key={mode} entering={FadeIn.duration(250)} style={styles.hero}>
            <View style={styles.logo}>
              <MaterialCommunityIcons name={mode === 'signup' ? 'account-plus' : 'login'} size={34} color={Palette.white} />
            </View>
            <Text style={styles.title}>{mode === 'signup' ? 'Crée ton compte' : 'Bon retour !'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'signup'
                ? 'Ton dressing, tes favoris et tes préférences sauvegardés et retrouvés sur tous tes téléphones.'
                : 'Connecte-toi pour retrouver ton dressing sauvegardé.'}
            </Text>
          </Animated.View>

          {/* Bascule inscription / connexion */}
          <View style={styles.switcher}>
            {(['signup', 'login'] as const).map((m) => (
              <Pressable key={m} style={[styles.switchItem, mode === m && styles.switchItemOn]} onPress={() => switchMode(m)}>
                <Text style={[styles.switchText, mode === m && styles.switchTextOn]}>
                  {m === 'signup' ? 'Inscription' : 'Connexion'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <MaterialCommunityIcons name="email-outline" size={20} color={Palette.textSecondary} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Adresse e-mail"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
              />
              {emailOk && <MaterialCommunityIcons name="check-circle" size={18} color={Palette.success} />}
            </View>
            <View style={styles.field}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={Palette.textSecondary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe"
                placeholderTextColor={Palette.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                onSubmitEditing={() => canSubmit && submit()}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Palette.textSecondary} />
              </Pressable>
            </View>
            {mode === 'signup' && (
              <Text style={[styles.hint, password.length > 0 && !passwordOk && styles.hintWarn]}>
                Au moins {MIN_PASSWORD} caractères
              </Text>
            )}

            {!configured && (
              <Text style={styles.notice}>Les comptes ne sont pas encore disponibles dans cette version. Tu peux continuer sans compte.</Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {info ? <Text style={styles.info}>{info}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.primary, !canSubmit && styles.primaryOff]} disabled={!canSubmit} onPress={submit}>
            {busy
              ? <ActivityIndicator color={Palette.black} />
              : <Text style={styles.primaryText}>{mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}</Text>}
          </Pressable>
          <Pressable onPress={() => switchMode(mode === 'signup' ? 'login' : 'signup')} hitSlop={8}>
            <Text style={styles.footerLink}>
              {mode === 'signup' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
              <Text style={styles.footerLinkStrong}>{mode === 'signup' ? 'Se connecter' : 'S’inscrire'}</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center' },
  iconSpacer: { width: 44, height: 44 },
  skip: { color: Palette.white, fontWeight: '600', fontSize: 15, opacity: 0.85 },
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 28 },
  hero: { alignItems: 'center', gap: 12 },
  logo: { width: 76, height: 76, borderRadius: 38, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { color: Palette.white, fontSize: 32, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  switcher: { flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: 999, padding: 4 },
  switchItem: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },
  switchItemOn: { backgroundColor: Palette.ink },
  switchText: { color: Palette.textSecondary, fontWeight: '600', fontSize: 15 },
  switchTextOn: { color: Palette.white },
  form: { gap: 12 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Palette.surface, borderRadius: 18, paddingHorizontal: 16, height: 58,
  },
  input: { flex: 1, color: Palette.text, fontSize: 16, height: '100%' },
  hint: { color: Palette.textSecondary, fontSize: 13, marginLeft: 6 },
  hintWarn: { color: Palette.warning },
  notice: { color: Palette.warning, fontSize: 14, textAlign: 'center' },
  error: { color: Palette.white, backgroundColor: 'rgba(255,107,122,0.22)', borderRadius: 14, padding: 12, overflow: 'hidden' },
  info: { color: Palette.white, backgroundColor: 'rgba(52,211,153,0.2)', borderRadius: 14, padding: 12, overflow: 'hidden' },
  footer: { paddingHorizontal: 20, paddingBottom: 24, gap: 16, alignItems: 'center' },
  primary: { alignSelf: 'stretch', backgroundColor: Palette.white, borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  primaryOff: { opacity: 0.35 },
  primaryText: { color: Palette.black, fontSize: 16, fontWeight: '700' },
  footerLink: { color: Palette.textSecondary, fontSize: 15 },
  footerLinkStrong: { color: Palette.white, fontWeight: '700' },
});
