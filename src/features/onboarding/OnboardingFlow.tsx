import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator, Animated as RNAnimated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import AuroraScreen from '@/components/AuroraScreen';
import { ListRow } from '@/components/ListRow';
import { STYLE_OPTIONS } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import AuthScreen, { type AuthMode } from '@/features/auth/AuthScreen';
import ShopImport from '@/features/import/ShopImport';
import { type ColdLevel, patchStoredProfile } from '@/hooks/useProfile';
import type { Style } from '@/types';
import ShopLogo from './ShopLogo';
import {
  AGE_OPTIONS, CHANNEL_OPTIONS, COUNTRIES, GENDER_OPTIONS, GOAL_OPTIONS, OCCUPATION_OPTIONS, SHOPS,
  loadProfile, saveProfile, type Option, type UserProfile,
} from './profile';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Answers extends Omit<UserProfile, 'onboardingDone'> {
  name?: string;
  style?: Style;
  cold?: ColdLevel;
}

// Questions, dans l'ordre (une par écran, avec barre de progression)
const QUESTIONS = [
  'name', 'goals', 'gender', 'style', 'cold', 'occupation', 'age', 'country', 'channels', 'shops',
] as const;
type Question = (typeof QUESTIONS)[number];
type Step = 'welcome' | Question | 'building' | 'summary' | 'auth' | 'import';

const STYLE_ICONS: Record<Style, IconName> = {
  casual: 'tshirt-crew-outline', sport: 'run', formel: 'tie', soiree: 'glass-cocktail',
};

const COLD_OPTIONS: Option<ColdLevel>[] = [
  { key: 'frileux', label: 'J’ai souvent froid', icon: 'snowflake' },
  { key: 'normal', label: 'Ça dépend des jours', icon: 'thermometer' },
  { key: 'chaud', label: 'J’ai souvent chaud', icon: 'fire' },
];

// Pastilles de couleur des cartes de réponse, attribuées dans l'ordre
const TINTS = ['#7C5CFF', '#3B82F6', '#1FBF8F', '#F59E0B', '#EC4899', '#A8735A'];

const AUTO_NEXT_MS = 260; // délai avant de passer à la question suivante après un choix unique

const toggle = <T extends string>(list: T[] | undefined, value: T): T[] => {
  const cur = list ?? [];
  return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
};

// ---------- Cartes de réponse ----------
function ChoiceCard({ option, index, selected, multi, onPress }: {
  option: Option; index: number; selected: boolean; multi?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, selected && styles.cardOn, pressed && styles.pressed]}>
      {option.icon && (
        <View style={[styles.cardBadge, { backgroundColor: TINTS[index % TINTS.length] }]}>
          <MaterialCommunityIcons name={option.icon as IconName} size={22} color={Palette.white} />
        </View>
      )}
      <Text style={styles.cardLabel}>{option.label}</Text>
      <MaterialCommunityIcons
        name={selected ? (multi ? 'checkbox-marked-circle' : 'radiobox-marked') : (multi ? 'checkbox-blank-circle-outline' : 'radiobox-blank')}
        size={24}
        color={selected ? Palette.accent : Palette.surfaceSelected}
      />
    </Pressable>
  );
}

function Feature({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}><MaterialCommunityIcons name={icon} size={22} color={Palette.white} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.primary, disabled && styles.primaryOff]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

// ---------- Flux principal ----------
export default function OnboardingFlow({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [a, setA] = useState<Answers>({});
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authFrom, setAuthFrom] = useState<'welcome' | 'summary'>('summary');

  const qIndex = QUESTIONS.indexOf(step as Question);
  const isQuestion = qIndex >= 0;

  // Barre de progression animée
  const [progress] = useState(() => new RNAnimated.Value(0));
  useEffect(() => {
    if (!isQuestion) return;
    RNAnimated.timing(progress, { toValue: (qIndex + 1) / QUESTIONS.length, duration: 300, useNativeDriver: false }).start();
  }, [qIndex, isQuestion, progress]);
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // Écran « on prépare ton profil » : courte pause avant le résumé
  useEffect(() => {
    if (step !== 'building') return;
    const timer = setTimeout(() => setStep('summary'), 2400);
    return () => clearTimeout(timer);
  }, [step]);

  const goTo = (next: Step) => setStep(next);
  const next = () => goTo(isQuestion && qIndex < QUESTIONS.length - 1 ? QUESTIONS[qIndex + 1] : 'building');
  const back = () => goTo(qIndex > 0 ? QUESTIONS[qIndex - 1] : 'welcome');

  /** Choix unique : on enregistre puis on avance tout seul, comme dans la plupart des questionnaires. */
  const pick = (patch: Partial<Answers>) => {
    Haptics.selectionAsync().catch(() => {});
    setA((p) => ({ ...p, ...patch }));
    setTimeout(next, AUTO_NEXT_MS);
  };

  const saveAnswers = async () => {
    const { name, style, cold, ...questionnaire } = a;
    await saveProfile({ ...questionnaire, onboardingDone: true });
    await patchStoredProfile({
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(style ? { style } : {}),
      ...(cold ? { cold } : {}),
    });
  };

  const finish = async () => {
    await saveAnswers();
    onFinish();
  };

  const afterAuth = async ({ restored }: { restored: boolean }) => {
    // Connexion d'un ancien utilisateur : sa sauvegarde contient déjà son profil
    if (restored && (await loadProfile())?.onboardingDone) { onFinish(); return; }
    if (authFrom === 'welcome') { goTo('name'); return; }
    if ((a.shops?.length ?? 0) > 0) goTo('import'); else finish();
  };

  // ---------- Écrans hors questions ----------
  if (step === 'welcome') {
    return (
      <AuroraScreen variant="hero">
        <View style={styles.welcome}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.welcomeHero}>
            <View style={styles.welcomeLogo}>
              <MaterialCommunityIcons name="hanger" size={44} color={Palette.white} />
            </View>
            <Text style={styles.welcomeTitle}>Ta tenue idéale,{'\n'}chaque matin</Text>
            <Text style={styles.welcomeText}>La météo du jour + ton dressing = la bonne tenue, en un coup d’œil.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.features}>
            <Feature icon="weather-partly-cloudy" title="Adaptée à la météo" text="Ni trop chaud, ni trop froid." />
            <Feature icon="tshirt-crew" title="Avec tes vrais vêtements" text="Prends-les en photo ou importe tes achats." />
            <Feature icon="bag-suitcase" title="Ta valise en 1 minute" text="Selon la météo de ta destination." />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(450).duration(400)} style={styles.welcomeFooter}>
            <PrimaryButton label="Commencer" onPress={() => goTo('name')} />
            <Pressable onPress={() => { setAuthMode('login'); setAuthFrom('welcome'); goTo('auth'); }} hitSlop={8}>
              <Text style={styles.footerLink}>J’ai déjà un compte · <Text style={styles.footerLinkStrong}>Se connecter</Text></Text>
            </Pressable>
          </Animated.View>
        </View>
      </AuroraScreen>
    );
  }

  if (step === 'building') {
    const lines = ['Analyse de tes réponses', 'Réglage selon ta sensibilité au froid', 'Préparation de tes premières tenues'];
    return (
      <AuroraScreen variant="hero">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.white} />
          <Text style={styles.buildingTitle}>On prépare ton profil…</Text>
          <View style={styles.buildingLines}>
            {lines.map((line, i) => (
              <Animated.View key={line} entering={FadeInDown.delay(400 + i * 600).duration(350)} style={styles.buildingLine}>
                <MaterialCommunityIcons name="check-circle" size={20} color={Palette.success} />
                <Text style={styles.buildingText}>{line}</Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </AuroraScreen>
    );
  }

  if (step === 'summary') {
    const styleLabel = STYLE_OPTIONS.find((s) => s.key === (a.style ?? 'casual'))?.label ?? 'Casual';
    const coldLabel = COLD_OPTIONS.find((c) => c.key === (a.cold ?? 'normal'))?.label ?? '';
    return (
      <AuroraScreen variant="hero">
        <ScrollView contentContainerStyle={styles.summary}>
          <Animated.View entering={FadeInDown.duration(450)} style={styles.summaryHero}>
            <View style={styles.welcomeLogo}>
              <MaterialCommunityIcons name="check-decagram" size={42} color={Palette.white} />
            </View>
            <Text style={styles.welcomeTitle}>Ton profil est prêt{a.name?.trim() ? `,\n${a.name.trim()}` : ''} !</Text>
            <Text style={styles.welcomeText}>Voilà ce que l’app retient pour composer tes tenues.</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.listCard}>
            <ListRow icon={STYLE_ICONS[a.style ?? 'casual']} tint={TINTS[0]} title="Style du quotidien" subtitle={styleLabel} />
            <ListRow icon="thermometer" tint={TINTS[5]} title="Ressenti" subtitle={coldLabel}
              value={a.cold === 'frileux' ? '+ chaud' : a.cold === 'chaud' ? '+ léger' : 'standard'} />
            <ListRow icon="target" tint={TINTS[2]} title="Objectifs" subtitle={a.goals?.length ? `${a.goals.length} choisi${a.goals.length > 1 ? 's' : ''}` : 'Aucun pour l’instant'} />
            <ListRow icon="storefront" tint={TINTS[3]} title="Boutiques favorites" subtitle={a.shops?.length ? `${a.shops.length} boutique${a.shops.length > 1 ? 's' : ''}` : 'Aucune'} />
          </Animated.View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Continuer" onPress={() => { setAuthMode('signup'); setAuthFrom('summary'); goTo('auth'); }} />
        </View>
      </AuroraScreen>
    );
  }

  if (step === 'auth') {
    return (
      <AuthScreen
        initialMode={authMode}
        onDone={afterAuth}
        onSkip={() => afterAuth({ restored: false })}
        onBack={() => goTo(authFrom)}
      />
    );
  }

  if (step === 'import') {
    return <ShopImport shopIds={a.shops ?? []} onBack={() => goTo('summary')} onDone={finish} />;
  }

  // ---------- Questions ----------
  const firstName = a.name?.trim();
  let title = '';
  let subtitle: string | undefined;
  let canContinue = true;
  let multi = false;
  let content: ReactNode = null;

  switch (step) {
    case 'name':
      title = 'Comment tu t’appelles ?';
      subtitle = 'Pour te dire bonjour chaque matin.';
      canContinue = !!firstName;
      content = (
        <TextInput
          style={styles.nameInput}
          value={a.name ?? ''}
          onChangeText={(name) => setA((p) => ({ ...p, name }))}
          placeholder="Ton prénom"
          placeholderTextColor={Palette.textSecondary}
          autoFocus
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={() => firstName && next()}
        />
      );
      break;
    case 'goals':
      title = firstName ? `Enchanté, ${firstName} ! Qu’attends-tu de l’app ?` : 'Qu’attends-tu de l’app ?';
      subtitle = 'Plusieurs réponses possibles.';
      multi = true;
      canContinue = (a.goals?.length ?? 0) > 0;
      content = GOAL_OPTIONS.map((o, i) => (
        <ChoiceCard key={o.key} option={o} index={i} multi selected={a.goals?.includes(o.key) ?? false}
          onPress={() => setA((p) => ({ ...p, goals: toggle(p.goals, o.key) }))} />
      ));
      break;
    case 'gender':
      title = 'Tu es…';
      subtitle = 'Pour adapter les suggestions à ta silhouette.';
      content = GENDER_OPTIONS.map((o, i) => (
        <ChoiceCard key={o.key} option={o} index={i} selected={a.gender === o.key} onPress={() => pick({ gender: o.key })} />
      ));
      break;
    case 'style':
      title = 'Ton style au quotidien ?';
      subtitle = 'Tu pourras toujours changer d’occasion sur l’accueil.';
      content = (
        <View style={styles.tiles}>
          {STYLE_OPTIONS.map((o, i) => {
            const selected = a.style === o.key;
            return (
              <Pressable key={o.key} onPress={() => pick({ style: o.key })}
                style={({ pressed }) => [styles.tile, selected && styles.cardOn, pressed && styles.pressed]}>
                <View style={[styles.tileBadge, { backgroundColor: TINTS[i] }]}>
                  <MaterialCommunityIcons name={STYLE_ICONS[o.key]} size={30} color={Palette.white} />
                </View>
                <Text style={styles.tileLabel}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
      break;
    case 'cold':
      title = 'Plutôt frileux ou toujours en t-shirt ?';
      subtitle = 'On ajuste la chaleur des tenues proposées.';
      content = COLD_OPTIONS.map((o, i) => (
        <ChoiceCard key={o.key} option={o} index={i + 1} selected={a.cold === o.key} onPress={() => pick({ cold: o.key })} />
      ));
      break;
    case 'occupation':
      title = 'Quelle est ta situation ?';
      subtitle = 'Un look de bureau ou de cours ne se compose pas pareil.';
      content = OCCUPATION_OPTIONS.map((o, i) => (
        <ChoiceCard key={o.key} option={o} index={i} selected={a.occupation === o.key} onPress={() => pick({ occupation: o.key })} />
      ));
      break;
    case 'age':
      title = 'Quel âge as-tu ?';
      content = (
        <View style={styles.chips}>
          {AGE_OPTIONS.map((o) => (
            <Pressable key={o.key} onPress={() => pick({ ageRange: o.key })} style={[styles.chip, a.ageRange === o.key && styles.chipOn]}>
              <Text style={[styles.chipText, a.ageRange === o.key && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      );
      break;
    case 'country':
      title = 'Dans quel pays vis-tu ?';
      subtitle = 'Les boutiques et le climat varient selon les pays.';
      content = (
        <View style={styles.chips}>
          {COUNTRIES.map((c) => (
            <Pressable key={c} onPress={() => pick({ country: c })} style={[styles.chip, a.country === c && styles.chipOn]}>
              <Text style={[styles.chipText, a.country === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      );
      break;
    case 'channels':
      title = 'Où achètes-tu tes vêtements ?';
      subtitle = 'Plusieurs réponses possibles.';
      multi = true;
      canContinue = (a.channels?.length ?? 0) > 0;
      content = CHANNEL_OPTIONS.map((o, i) => (
        <ChoiceCard key={o.key} option={o} index={i} multi selected={a.channels?.includes(o.key) ?? false}
          onPress={() => setA((p) => ({ ...p, channels: toggle(p.channels, o.key) }))} />
      ));
      break;
    case 'shops':
      title = 'Tes boutiques préférées';
      subtitle = 'Tu pourras y importer tes achats en un geste.';
      multi = true;
      content = (
        <View style={styles.grid}>
          {SHOPS.map((shop) => {
            const selected = a.shops?.includes(shop.id) ?? false;
            return (
              <Pressable key={shop.id} style={[styles.shop, selected && styles.cardOn]}
                onPress={() => setA((p) => ({ ...p, shops: toggle(p.shops, shop.id) }))}>
                <ShopLogo shop={shop} size={48} />
                <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                {selected && (
                  <View style={styles.shopCheck}>
                    <MaterialCommunityIcons name="check" size={14} color={Palette.onAccent} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      );
      break;
  }

  // Le bouton n'est utile que pour la saisie du prénom et les choix multiples
  const showContinue = step === 'name' || multi;

  return (
    <AuroraScreen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={back} hitSlop={8} accessibilityLabel="Retour">
            <MaterialCommunityIcons name="arrow-left" size={22} color={Palette.white} />
          </Pressable>
          <View style={styles.barTrack}>
            <RNAnimated.View style={[styles.barFill, { width: barWidth }]} />
          </View>
          <Pressable onPress={next} hitSlop={12}>
            <Text style={styles.skip}>Passer</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeInRight.duration(280)} style={styles.question}>
            <Text style={styles.stepCount}>Question {qIndex + 1} sur {QUESTIONS.length}</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <View style={styles.content}>{content}</View>
          </Animated.View>
        </ScrollView>

        {showContinue && (
          <View style={styles.footer}>
            <PrimaryButton label="Continuer" disabled={!canContinue} onPress={next} />
          </View>
        )}
      </KeyboardAvoidingView>
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },

  // Accueil
  welcome: { flex: 1, paddingHorizontal: 20, paddingBottom: 24, justifyContent: 'space-between' },
  welcomeHero: { alignItems: 'center', gap: 14, paddingTop: 48 },
  welcomeLogo: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Palette.overlay,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  welcomeTitle: { color: Palette.white, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  welcomeText: { color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 320 },
  features: { backgroundColor: Palette.surface, borderRadius: 28, padding: 18, gap: 18 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: Palette.text, fontSize: 16, fontWeight: '700' },
  featureText: { color: Palette.textSecondary, fontSize: 14, marginTop: 2 },
  welcomeFooter: { gap: 18, alignItems: 'center' },
  footerLink: { color: Palette.textSecondary, fontSize: 15 },
  footerLinkStrong: { color: Palette.white, fontWeight: '700' },

  // Préparation et résumé
  buildingTitle: { color: Palette.white, fontSize: 24, fontWeight: '700' },
  buildingLines: { gap: 12, marginTop: 8 },
  buildingLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buildingText: { color: Palette.text, fontSize: 16 },
  summary: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24, gap: 28 },
  summaryHero: { alignItems: 'center', gap: 12 },
  listCard: { backgroundColor: Palette.surface, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 8 },

  // Questions
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center' },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Palette.white },
  skip: { color: Palette.white, fontWeight: '600', opacity: 0.85 },
  body: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  question: { gap: 8 },
  stepCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: Palette.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  content: { marginTop: 20, gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Palette.surface, borderRadius: 22, padding: 14, borderWidth: 2, borderColor: 'transparent',
  },
  cardOn: { borderColor: Palette.accent, backgroundColor: '#221C3D' },
  cardBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { flex: 1, fontSize: 17, fontWeight: '600', color: Palette.text },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 14,
    backgroundColor: Palette.surface, borderRadius: 24, borderWidth: 2, borderColor: 'transparent',
  },
  tileBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: Palette.text, fontSize: 18, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 999, backgroundColor: Palette.surface },
  chipOn: { backgroundColor: Palette.white },
  chipText: { fontSize: 16, color: Palette.text, fontWeight: '500' },
  chipTextOn: { color: Palette.black, fontWeight: '700' },

  nameInput: {
    backgroundColor: Palette.surface, borderRadius: 22, paddingHorizontal: 20, height: 64,
    color: Palette.text, fontSize: 22, fontWeight: '600',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shop: {
    width: '31%', flexGrow: 1, alignItems: 'center', gap: 8, paddingVertical: 16,
    borderRadius: 20, backgroundColor: Palette.surface, borderWidth: 2, borderColor: 'transparent',
  },
  shopName: { fontSize: 13, fontWeight: '600', maxWidth: '90%', color: Palette.text },
  shopCheck: {
    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center',
  },

  footer: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  primary: { backgroundColor: Palette.white, borderRadius: 999, paddingVertical: 17, alignItems: 'center', alignSelf: 'stretch' },
  primaryOff: { opacity: 0.35 },
  primaryText: { color: Palette.black, fontSize: 16, fontWeight: '700' },
});
