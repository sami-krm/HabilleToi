import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import AuroraScreen from '@/components/AuroraScreen';
import CloudSyncModal from '@/components/CloudSyncModal';
import { SettingsGroup, SettingsRow } from '@/components/SettingsRow';
import WeeklyPlanModal from '@/components/WeeklyPlanModal';
import { STYLE_OPTIONS, TYPE_LABELS, TYPE_ORDER } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import AuthScreen from '@/features/auth/AuthScreen';
import MorningReminderModal from '@/features/notifications/MorningReminderModal';
import {
  AGE_OPTIONS, CHANNEL_OPTIONS, COUNTRIES, GENDER_OPTIONS, OCCUPATION_OPTIONS, SHOPS,
  loadProfile, saveProfile as saveQuestionnaire, type UserProfile,
} from '@/features/onboarding/profile';
import ShopLogo from '@/features/onboarding/ShopLogo';
import type { ColdLevel, Profile } from '@/hooks/useProfile';
import { clearUserData, exportBackup, importBackup } from '@/services/backupService';
import { enableCalendarAccess } from '@/services/calendarOccasion';
import { getCloudSession, signOutCloudAccount, type CloudSession } from '@/services/cloudSync';
import { DEFAULT_LAUNDRY, loadLaundryThresholds, saveLaundryThresholds } from '@/storage/preferences';
import { loadFavorites, loadHistory, loadWardrobe } from '@/storage/wardrobeStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  onDataRestored?: () => void;
}

type Page = 'main' | 'name' | 'style' | 'cold' | 'laundry' | 'shops' | 'about';

const PAGE_TITLES: Record<Exclude<Page, 'main'>, string> = {
  name: 'Prénom',
  style: 'Style du quotidien',
  cold: 'Ressenti du froid',
  laundry: 'Lavage automatique',
  shops: 'Boutiques préférées',
  about: 'À propos de moi',
};

const COLD_CHOICES: { key: ColdLevel; label: string; hint: string; icon: 'snowflake' | 'thermometer' | 'fire' }[] = [
  { key: 'frileux', label: 'J’ai souvent froid', hint: 'Tenues un peu plus chaudes', icon: 'snowflake' },
  { key: 'normal', label: 'Ça dépend des jours', hint: 'Tenues selon la météo', icon: 'thermometer' },
  { key: 'chaud', label: 'J’ai souvent chaud', hint: 'Tenues un peu plus légères', icon: 'fire' },
];

const COLD_LABELS: Record<ColdLevel, string> = { frileux: 'Frileux', normal: 'Normal', chaud: 'Toujours chaud' };

// Couleurs des pastilles d'icônes, comme dans les réglages iOS
const T = {
  purple: '#7C5CFF', blue: '#3B82F6', green: '#1FBF8F', orange: '#F59E0B',
  pink: '#EC4899', brown: '#A8735A', gray: '#6B7280', red: '#EF4444', teal: '#14B8A6',
};

// ---------- Petits éléments des sous-pages ----------
function Choice({ label, hint, selected, onPress, icon }: {
  label: string; hint?: string; selected: boolean; onPress: () => void; icon?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && styles.pressed]}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {hint && <Text style={styles.choiceHint}>{hint}</Text>}
      </View>
      <MaterialCommunityIcons
        name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
        size={22}
        color={selected ? Palette.accent : Palette.surfaceSelected}
      />
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileModal({ visible, onClose, profile, update, onDataRestored = () => {} }: Props) {
  const [page, setPage] = useState<Page>('main');
  const [questionnaire, setQuestionnaire] = useState<UserProfile>({ onboardingDone: false });
  const [thresholds, setThresholds] = useState(DEFAULT_LAUNDRY);
  const [stats, setStats] = useState({ items: 0, worn: 0, favorites: 0 });
  const [session, setSession] = useState<CloudSession | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // On revient toujours sur la page principale à la prochaine ouverture
  const close = () => { setPage('main'); onClose(); };

  const refreshSession = () => getCloudSession().then(setSession).catch(() => setSession(null));

  useEffect(() => {
    if (!visible) return;
    loadProfile().then((value) => value && setQuestionnaire(value));
    loadLaundryThresholds().then(setThresholds);
    Promise.all([loadWardrobe(), loadHistory(), loadFavorites()])
      .then(([items, history, favorites]) => setStats({ items: items.length, worn: history.length, favorites: favorites.length }))
      .catch(() => {});
    refreshSession();
  }, [visible]);

  // ---------- Actions ----------
  const patchQuestionnaire = (patch: Partial<UserProfile>) => {
    const next = { ...questionnaire, ...patch };
    setQuestionnaire(next);
    saveQuestionnaire(next).catch(() => {});
  };

  const setThreshold = (type: keyof typeof thresholds, delta: number) => {
    const next = { ...thresholds, [type]: Math.min(30, Math.max(1, thresholds[type] + delta)) };
    setThresholds(next);
    saveLaundryThresholds(next).catch(() => {});
  };

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled) update({ avatar: res.assets[0].uri });
  };

  const toggleCalendar = async (enabled: boolean) => {
    if (!enabled) { update({ calendarEnabled: false }); return; }
    try {
      if (await enableCalendarAccess()) update({ calendarEnabled: true });
      else Alert.alert('Accès refusé', 'Autorise le calendrier dans les réglages pour détecter l’occasion de ta journée.');
    } catch {
      Alert.alert('Calendrier indisponible', 'Impossible de demander l’accès au calendrier sur cet appareil.');
    }
  };

  const doExport = async () => {
    try {
      setBusy(true);
      await exportBackup();
      Alert.alert('Sauvegarde prête', Platform.OS === 'android'
        ? 'Le fichier a été créé dans le dossier que tu as choisi.'
        : 'Le fichier est dans Fichiers > Sur mon iPhone > Tenue du jour. Tu peux le déplacer vers iCloud Drive.');
    } catch {
      Alert.alert('Export impossible', 'La sauvegarde n’a pas pu être créée.');
    } finally { setBusy(false); }
  };

  const doImport = () => Alert.alert('Restaurer une sauvegarde ?', 'Les données actuelles seront remplacées par celles du fichier choisi.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Choisir un fichier', onPress: async () => {
      try {
        setBusy(true);
        const count = await importBackup();
        if (count) { Alert.alert('Restauration terminée', `${count} éléments restaurés.`); onDataRestored(); }
      } catch (error) {
        Alert.alert('Import impossible', error instanceof Error ? error.message : 'Le fichier n’a pas pu être restauré.');
      } finally { setBusy(false); }
    } },
  ]);

  const doSignOut = () => Alert.alert('Se déconnecter ?', 'Tes données restent sur ce téléphone.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Se déconnecter', style: 'destructive', onPress: async () => { await signOutCloudAccount(); setSession(null); } },
  ]);

  const doClear = () => Alert.alert('Supprimer toutes les données ?', 'Cette action efface le dressing, les favoris, l’historique et le profil de ce téléphone.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Tout supprimer', style: 'destructive', onPress: async () => {
      await clearUserData();
      Alert.alert('Données supprimées', 'Redémarre l’app pour recommencer.');
      close();
    } },
  ]);

  // ---------- Libellés affichés à droite des lignes ----------
  const styleLabel = STYLE_OPTIONS.find((s) => s.key === profile.style)?.label ?? '';
  const aboutLabel = [
    GENDER_OPTIONS.find((g) => g.key === questionnaire.gender)?.label.split(' ')[0],
    AGE_OPTIONS.find((a) => a.key === questionnaire.ageRange)?.label,
  ].filter(Boolean).join(' · ');
  const shopsCount = questionnaire.shops?.length ?? 0;
  const version = Constants.expoConfig?.version ?? '';

  // ---------- Page principale ----------
  const renderMain = () => (
    <>
      {/* En-tête : photo, prénom et compte */}
      <View style={styles.hero}>
        <Pressable onPress={pickAvatar} style={styles.avatarWrap} accessibilityLabel="Changer la photo">
          {profile.avatar
            ? <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            : <Text style={styles.initial}>{profile.name.trim().charAt(0).toUpperCase() || '?'}</Text>}
          <View style={styles.cameraBadge}>
            <MaterialCommunityIcons name="camera" size={14} color={Palette.black} />
          </View>
        </Pressable>
        <Text style={styles.name}>{profile.name.trim() || 'Ajoute ton prénom'}</Text>
        <Text style={styles.email}>{session?.user.email ?? 'Compte local · non synchronisé'}</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={stats.items} label={stats.items > 1 ? 'Vêtements' : 'Vêtement'} />
        <View style={styles.statDivider} />
        <Stat value={stats.worn} label={stats.worn > 1 ? 'Tenues portées' : 'Tenue portée'} />
        <View style={styles.statDivider} />
        <Stat value={stats.favorites} label={stats.favorites > 1 ? 'Favoris' : 'Favori'} />
      </View>

      {/* Carte compte : invitation à créer un compte, ou état de la synchro */}
      {session ? (
        <SettingsGroup>
          <SettingsRow icon="cloud-check" tint={T.green} title="Synchronisation en ligne" subtitle="Sauvegarde et restauration du dressing" onPress={() => setCloudOpen(true)} last />
        </SettingsGroup>
      ) : (
        <Pressable style={styles.accountCta} onPress={() => setAuthOpen(true)}>
          <View style={styles.accountIcon}><MaterialCommunityIcons name="account-plus" size={24} color={Palette.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountTitle}>Crée ton compte</Text>
            <Text style={styles.accountText}>Sauvegarde ton dressing et retrouve-le sur tous tes téléphones.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={Palette.white} />
        </Pressable>
      )}

      <SettingsGroup title="Mes préférences">
        <SettingsRow icon="account" tint={T.purple} title="Prénom" value={profile.name.trim() || 'À compléter'} onPress={() => setPage('name')} />
        <SettingsRow icon="hanger" tint={T.pink} title="Style du quotidien" value={styleLabel} onPress={() => setPage('style')} />
        <SettingsRow icon="thermometer" tint={T.brown} title="Ressenti du froid" value={COLD_LABELS[profile.cold]} onPress={() => setPage('cold')} />
        <SettingsRow
          icon="temperature-celsius"
          tint={T.orange}
          title="Unité de température"
          last
          right={(
            <View style={styles.unitSwitch}>
              {(['C', 'F'] as const).map((u) => (
                <Pressable key={u} onPress={() => update({ unit: u })} style={[styles.unitItem, profile.unit === u && styles.unitItemOn]}>
                  <Text style={[styles.unitText, profile.unit === u && styles.unitTextOn]}>°{u}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      </SettingsGroup>

      <SettingsGroup title="Rappels et calendrier" footer="Les titres d’événements sont lus uniquement sur ce téléphone.">
        <SettingsRow icon="bell-ring" tint={T.red} title="Rappel du matin" onPress={() => setReminderOpen(true)} />
        <SettingsRow icon="bell-badge" tint={T.orange} title="Notifications" right={<Switch value={profile.notifications} onValueChange={(notifications) => update({ notifications })} />} />
        <SettingsRow icon="calendar-star" tint={T.blue} title="Adapter à mon calendrier" right={<Switch value={profile.calendarEnabled} onValueChange={toggleCalendar} />} />
        <SettingsRow icon="calendar-week" tint={T.teal} title="Planning de la semaine" onPress={() => setWeeklyOpen(true)} last />
      </SettingsGroup>

      <SettingsGroup title="Mon dressing">
        <SettingsRow icon="washing-machine" tint={T.blue} title="Lavage automatique" subtitle="Nombre de ports avant le sale" onPress={() => setPage('laundry')} />
        <SettingsRow icon="storefront" tint={T.orange} title="Boutiques préférées" value={shopsCount ? String(shopsCount) : 'Aucune'} onPress={() => setPage('shops')} />
        <SettingsRow icon="card-account-details" tint={T.purple} title="À propos de moi" subtitle={aboutLabel || 'Genre, âge, situation, pays'} onPress={() => setPage('about')} last />
      </SettingsGroup>

      <SettingsGroup title="Données">
        {!session && <SettingsRow icon="cloud-sync" tint={T.green} title="Synchronisation en ligne" onPress={() => setCloudOpen(true)} />}
        <SettingsRow icon="tray-arrow-up" tint={T.gray} title="Exporter une sauvegarde" subtitle="Fichiers, iCloud Drive…" onPress={busy ? undefined : doExport}
          right={busy ? <ActivityIndicator color={Palette.textSecondary} /> : undefined} />
        <SettingsRow icon="backup-restore" tint={T.gray} title="Restaurer une sauvegarde" onPress={busy ? undefined : doImport} last />
      </SettingsGroup>

      <SettingsGroup>
        {session && <SettingsRow icon="logout" tint={T.gray} title="Se déconnecter" onPress={doSignOut} danger />}
        <SettingsRow icon="delete" tint={T.red} title="Supprimer toutes mes données" onPress={doClear} danger last />
      </SettingsGroup>

      <Text style={styles.version}>Tenue du jour{version ? ` · version ${version}` : ''}</Text>
    </>
  );

  // ---------- Sous-pages ----------
  const renderPage = () => {
    switch (page) {
      case 'name':
        return (
          <>
            <TextInput
              style={styles.nameInput}
              value={profile.name}
              onChangeText={(name) => update({ name })}
              placeholder="Ton prénom"
              placeholderTextColor={Palette.textSecondary}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => setPage('main')}
            />
            <Text style={styles.pageHint}>Affiché sur l’accueil : « Ta tenue du jour, {profile.name.trim() || 'toi'} ».</Text>
          </>
        );
      case 'style':
        return STYLE_OPTIONS.map((o) => (
          <Choice key={o.key} label={o.label} selected={profile.style === o.key} onPress={() => { update({ style: o.key }); setPage('main'); }} />
        ));
      case 'cold':
        return COLD_CHOICES.map((c) => (
          <Choice
            key={c.key}
            label={c.label}
            hint={c.hint}
            selected={profile.cold === c.key}
            onPress={() => { update({ cold: c.key }); setPage('main'); }}
            icon={<View style={[styles.choiceIcon, { backgroundColor: c.key === 'frileux' ? T.blue : c.key === 'chaud' ? T.orange : T.green }]}>
              <MaterialCommunityIcons name={c.icon} size={20} color={Palette.white} />
            </View>}
          />
        ));
      case 'laundry':
        return (
          <>
            <Text style={styles.pageHint}>Une pièce passe au sale après ce nombre de ports.</Text>
            <View style={styles.listCard}>
              {TYPE_ORDER.map((type, i) => (
                <View key={type} style={[styles.stepRow, i < TYPE_ORDER.length - 1 && styles.stepSeparator]}>
                  <Text style={styles.stepLabel}>{TYPE_LABELS[type]}</Text>
                  <Pressable style={styles.stepBtn} onPress={() => setThreshold(type, -1)} accessibilityLabel={`Moins pour ${TYPE_LABELS[type]}`}>
                    <MaterialCommunityIcons name="minus" size={18} color={Palette.text} />
                  </Pressable>
                  <Text style={styles.stepValue}>{thresholds[type]}</Text>
                  <Pressable style={styles.stepBtn} onPress={() => setThreshold(type, 1)} accessibilityLabel={`Plus pour ${TYPE_LABELS[type]}`}>
                    <MaterialCommunityIcons name="plus" size={18} color={Palette.text} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Pressable onPress={() => { setThresholds(DEFAULT_LAUNDRY); saveLaundryThresholds(DEFAULT_LAUNDRY).catch(() => {}); }} hitSlop={8}>
              <Text style={styles.resetLink}>Revenir aux valeurs par défaut</Text>
            </Pressable>
          </>
        );
      case 'shops':
        return (
          <View style={styles.shopGrid}>
            {SHOPS.map((shop) => {
              const selected = questionnaire.shops?.includes(shop.id) ?? false;
              return (
                <Pressable key={shop.id} style={[styles.shop, selected && styles.choiceOn]}
                  onPress={() => patchQuestionnaire({ shops: selected ? questionnaire.shops?.filter((id) => id !== shop.id) : [...(questionnaire.shops ?? []), shop.id] })}>
                  <ShopLogo shop={shop} size={44} />
                  <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                  {selected && <View style={styles.shopCheck}><MaterialCommunityIcons name="check" size={13} color={Palette.white} /></View>}
                </Pressable>
              );
            })}
          </View>
        );
      case 'about':
        return (
          <>
            <Text style={styles.sectionLabel}>Genre</Text>
            <View style={styles.chips}>
              {GENDER_OPTIONS.map((o) => <Chip key={o.key} label={o.label} selected={questionnaire.gender === o.key} onPress={() => patchQuestionnaire({ gender: o.key })} />)}
            </View>
            <Text style={styles.sectionLabel}>Tranche d’âge</Text>
            <View style={styles.chips}>
              {AGE_OPTIONS.map((o) => <Chip key={o.key} label={o.label} selected={questionnaire.ageRange === o.key} onPress={() => patchQuestionnaire({ ageRange: o.key })} />)}
            </View>
            <Text style={styles.sectionLabel}>Situation</Text>
            <View style={styles.chips}>
              {OCCUPATION_OPTIONS.map((o) => <Chip key={o.key} label={o.label} selected={questionnaire.occupation === o.key} onPress={() => patchQuestionnaire({ occupation: o.key })} />)}
            </View>
            <Text style={styles.sectionLabel}>Pays</Text>
            <View style={styles.chips}>
              {COUNTRIES.map((c) => <Chip key={c} label={c} selected={questionnaire.country === c} onPress={() => patchQuestionnaire({ country: c })} />)}
            </View>
            <Text style={styles.sectionLabel}>Où j’achète mes vêtements</Text>
            <View style={styles.chips}>
              {CHANNEL_OPTIONS.map((o) => {
                const selected = questionnaire.channels?.includes(o.key) ?? false;
                return <Chip key={o.key} label={o.label} selected={selected} onPress={() => patchQuestionnaire({
                  channels: selected ? questionnaire.channels?.filter((c) => c !== o.key) : [...(questionnaire.channels ?? []), o.key],
                })} />;
              })}
            </View>
          </>
        );
      default:
        return null;
    }
  };

  const isMain = page === 'main';

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={isMain ? close : () => setPage('main')}>
        <AuroraScreen>
          <View style={styles.header}>
            {isMain ? <View style={styles.headerBtnSpacer} /> : (
              <Pressable style={styles.headerBtn} onPress={() => setPage('main')} hitSlop={8} accessibilityLabel="Retour">
                <MaterialCommunityIcons name="chevron-left" size={26} color={Palette.white} />
              </Pressable>
            )}
            <Text style={styles.headerTitle}>{isMain ? 'Mon profil' : PAGE_TITLES[page]}</Text>
            {isMain ? (
              <Pressable style={styles.headerBtn} onPress={close} hitSlop={8} accessibilityLabel="Fermer">
                <MaterialCommunityIcons name="close" size={22} color={Palette.white} />
              </Pressable>
            ) : <View style={styles.headerBtnSpacer} />}
          </View>

          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Animated.View key={page} entering={FadeIn.duration(200)} style={styles.page}>
              {isMain ? renderMain() : renderPage()}
            </Animated.View>
          </ScrollView>
        </AuroraScreen>
      </Modal>

      <MorningReminderModal visible={reminderOpen} onClose={() => setReminderOpen(false)} />
      <WeeklyPlanModal visible={weeklyOpen} onClose={() => setWeeklyOpen(false)} />
      <CloudSyncModal visible={cloudOpen} onClose={() => { setCloudOpen(false); refreshSession(); }} onRestored={onDataRestored} />
      <Modal visible={authOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAuthOpen(false)}>
        <AuthScreen
          onDone={({ restored }) => { setAuthOpen(false); refreshSession(); if (restored) onDataRestored(); }}
          onSkip={() => setAuthOpen(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center' },
  headerBtnSpacer: { width: 40, height: 40 },
  headerTitle: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  container: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 60 },
  page: { gap: 22 },

  hero: { alignItems: 'center', gap: 4, paddingTop: 8 },
  avatarWrap: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: Palette.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  initial: { color: Palette.white, fontSize: 44, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#2A1366',
  },
  name: { color: Palette.white, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  email: { color: 'rgba(255,255,255,0.75)', fontSize: 15 },

  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: 22, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: Palette.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: Palette.textSecondary, fontSize: 12, fontWeight: '500' },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.12)' },

  accountCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22,
    backgroundColor: Palette.accent,
  },
  accountIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  accountTitle: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  accountText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },

  unitSwitch: { flexDirection: 'row', backgroundColor: Palette.surfaceRaised, borderRadius: 999, padding: 3 },
  unitItem: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  unitItemOn: { backgroundColor: Palette.white },
  unitText: { color: Palette.textSecondary, fontWeight: '700', fontSize: 14 },
  unitTextOn: { color: Palette.black },

  version: { color: Palette.textSecondary, fontSize: 12, textAlign: 'center' },

  // Sous-pages
  pageHint: { color: Palette.textSecondary, fontSize: 14, marginHorizontal: 4, marginTop: -8 },
  nameInput: {
    backgroundColor: Palette.surface, borderRadius: 22, paddingHorizontal: 20, height: 64,
    color: Palette.text, fontSize: 22, fontWeight: '600',
  },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: -12,
    backgroundColor: Palette.surface, borderRadius: 20, padding: 16, borderWidth: 2, borderColor: 'transparent',
  },
  choiceOn: { borderColor: Palette.accent, backgroundColor: '#221C3D' },
  choiceLabel: { color: Palette.text, fontSize: 17, fontWeight: '600' },
  choiceHint: { color: Palette.textSecondary, fontSize: 13, marginTop: 2 },
  choiceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  listCard: { backgroundColor: Palette.surface, borderRadius: 22, paddingHorizontal: 16, marginTop: -8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  stepSeparator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  stepLabel: { flex: 1, color: Palette.text, fontSize: 16 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: Palette.text, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  resetLink: { color: Palette.accent, fontWeight: '600', textAlign: 'center' },

  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shop: {
    width: '31%', flexGrow: 1, alignItems: 'center', gap: 8, paddingVertical: 14,
    borderRadius: 20, backgroundColor: Palette.surface, borderWidth: 2, borderColor: 'transparent',
  },
  shopName: { color: Palette.text, fontSize: 13, fontWeight: '600' },
  shopCheck: {
    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center',
  },

  sectionLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: -12, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: Palette.surface },
  chipOn: { backgroundColor: Palette.white },
  chipText: { color: Palette.text, fontSize: 15, fontWeight: '500' },
  chipTextOn: { color: Palette.black, fontWeight: '700' },
});
