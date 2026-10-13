import AuroraScreen from '@/components/AuroraScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import ShopImport from '@/features/import/ShopImport';
import ShopLogo from './ShopLogo';
import type { AgeRange, Channel, Gender, Occupation, Option, UserProfile } from './profile';
import {
    AGE_OPTIONS, CHANNEL_OPTIONS, COUNTRIES, GENDER_OPTIONS, OCCUPATION_OPTIONS, SHOPS, saveProfile,
} from './profile';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Answers = Omit<UserProfile, 'onboardingDone'>;
type StepKey = 'gender' | 'country' | 'channels' | 'occupation' | 'age' | 'shops' | 'import';

const STEPS: StepKey[] = ['gender', 'country', 'channels', 'occupation', 'age', 'shops', 'import'];

const TEXTS: Record<Exclude<StepKey, 'import'>, { title: string; subtitle?: string }> = {
  gender: { title: 'Tu es…', subtitle: 'Pour adapter les suggestions à ton style.' },
  country: { title: 'Dans quel pays vis-tu ?', subtitle: 'Les boutiques et le climat varient selon les pays.' },
  channels: { title: 'Où commandes-tu tes vêtements ?', subtitle: 'Plusieurs réponses possibles.' },
  occupation: { title: 'Quelle est ta situation ?', subtitle: 'Un look de bureau ou de cours ne se compose pas pareil.' },
  age: { title: 'Quel âge as-tu ?' },
  shops: { title: 'Tes boutiques préférées', subtitle: 'Choisis-en autant que tu veux.' },
};

// ---------- Petits composants ----------
function OptionCard({
  option, selected, multi, onPress,
}: { option: Option; selected: boolean; multi?: boolean; onPress: () => void }) {
  const color = selected ? Palette.onAccent : Palette.text;
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardActive]}>
      {option.icon && <MaterialCommunityIcons name={option.icon as IconName} size={22} color={color} />}
      <Text style={[styles.cardLabel, selected && styles.cardLabelActive]}>{option.label}</Text>
      {multi && (
        <MaterialCommunityIcons
          name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={22}
          color={color}
        />
      )}
    </Pressable>
  );
}

// ---------- Flux principal ----------
export default function OnboardingFlow({ onFinish }: { onFinish: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [a, setA] = useState<Answers>({});
  const step = STEPS[stepIndex];

  // Barre de progression animée
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: (stepIndex + 1) / STEPS.length,
      duration: 250,
      useNativeDriver: false, // on anime une largeur
    }).start();
  }, [stepIndex, progress]);
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const finish = async () => {
    await saveProfile({ ...a, onboardingDone: true });
    onFinish();
  };

  const toggle = <T extends string>(list: T[] | undefined, value: T): T[] => {
    const cur = list ?? [];
    return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  };

  // Étape finale : import des achats (gère son propre affichage)
  if (step === 'import') {
    return <ShopImport shopIds={a.shops ?? []} onBack={back} onDone={finish} />;
  }

  // Peut-on continuer ? (« Passer » reste toujours possible)
  const canContinue =
    (step === 'gender' && !!a.gender) ||
    (step === 'country' && !!a.country) ||
    (step === 'channels' && (a.channels?.length ?? 0) > 0) ||
    (step === 'occupation' && !!a.occupation) ||
    (step === 'age' && !!a.ageRange) ||
    step === 'shops';

  const renderContent = () => {
    switch (step) {
      case 'gender':
        return GENDER_OPTIONS.map((o) => (
          <OptionCard key={o.key} option={o} selected={a.gender === o.key}
            onPress={() => setA((p) => ({ ...p, gender: o.key as Gender }))} />
        ));
      case 'country':
        return (
          <View style={styles.chips}>
            {COUNTRIES.map((c) => (
              <Pressable key={c} onPress={() => setA((p) => ({ ...p, country: c }))}
                style={[styles.chip, a.country === c && styles.chipActive]}>
                <Text style={[styles.chipText, a.country === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        );
      case 'channels':
        return CHANNEL_OPTIONS.map((o) => (
          <OptionCard key={o.key} option={o} multi selected={a.channels?.includes(o.key as Channel) ?? false}
            onPress={() => setA((p) => ({ ...p, channels: toggle(p.channels, o.key as Channel) }))} />
        ));
      case 'occupation':
        return OCCUPATION_OPTIONS.map((o) => (
          <OptionCard key={o.key} option={o} selected={a.occupation === o.key}
            onPress={() => setA((p) => ({ ...p, occupation: o.key as Occupation }))} />
        ));
      case 'age':
        return AGE_OPTIONS.map((o) => (
          <OptionCard key={o.key} option={o} selected={a.ageRange === o.key}
            onPress={() => setA((p) => ({ ...p, ageRange: o.key as AgeRange }))} />
        ));
      case 'shops':
        return (
          <View style={styles.grid}>
            {SHOPS.map((shop) => {
              const selected = a.shops?.includes(shop.id) ?? false;
              return (
                <Pressable key={shop.id} style={[styles.tile, selected && styles.tileActive]}
                  onPress={() => setA((p) => ({ ...p, shops: toggle(p.shops, shop.id) }))}>
                  <ShopLogo shop={shop} />
                  <Text style={styles.tileName} numberOfLines={1}>{shop.name}</Text>
                  {selected && (
                    <View style={styles.check}>
                      <MaterialCommunityIcons name="check" size={14} color={Palette.onAccent} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
    }
  };

  const { title, subtitle } = TEXTS[step];

  return (
    <AuroraScreen>
      {/* En-tête : flèche retour, barre de progression, « Passer » */}
      <View style={styles.header}>
        {stepIndex > 0 ? (
          <Pressable onPress={back} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={26} color={Palette.text} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: barWidth }]} />
        </View>
        <Pressable onPress={next} hitSlop={12}>
          <Text style={styles.skip}>Passer</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.content}>{renderContent()}</View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.primary, !canContinue && styles.primaryDisabled]}
          disabled={!canContinue} onPress={next}>
          <Text style={styles.primaryText}>Continuer</Text>
        </Pressable>
      </View>
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Palette.surfaceRaised, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: Palette.accent },
  skip: { color: Palette.textSecondary, fontWeight: '600' },
  body: { padding: 20, paddingTop: 28, gap: 8 },
  title: { fontSize: 28, fontWeight: '700', color: Palette.text },
  subtitle: { fontSize: 15, color: Palette.textSecondary },
  content: { marginTop: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Palette.surface, borderColor: Palette.border, borderWidth: 1, borderRadius: 16, padding: 16,
  },
  cardActive: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  cardLabel: { flex: 1, fontSize: 16, color: Palette.text },
  cardLabelActive: { color: Palette.onAccent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, backgroundColor: Palette.surfaceRaised },
  chipActive: { backgroundColor: Palette.accent },
  chipText: { fontSize: 16, color: Palette.textSecondary },
  chipTextActive: { color: Palette.onAccent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31.5%', alignItems: 'center', gap: 8, paddingVertical: 14,
    borderRadius: 14, backgroundColor: Palette.surface, borderWidth: 2, borderColor: Palette.border,
  },
  tileActive: { borderColor: Palette.accent, backgroundColor: Palette.accentSoft },
  tileName: { fontSize: 13, fontWeight: '600', maxWidth: '90%', color: Palette.text },
  check: {
    position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center',
  },
  footer: { padding: 20 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryDisabled: { backgroundColor: Palette.surfaceSelected, opacity: 0.55 },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
});
