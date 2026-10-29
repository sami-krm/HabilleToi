import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import {
  Modal, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { Palette } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TUTORIAL_KEY = '@app/tutorial-seen';

/** Vrai si le tuto n'a encore jamais été vu sur ce téléphone. */
export async function shouldShowTutorial(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(TUTORIAL_KEY)) === null; } catch { return false; }
}

const markTutorialSeen = () => AsyncStorage.setItem(TUTORIAL_KEY, 'true').catch(() => {});

// ---------- Petites maquettes d'écran ----------
function Pill({ icon, label, light }: { icon?: IconName; label: string; light?: boolean }) {
  return (
    <View style={[styles.pill, light && styles.pillLight]}>
      {icon && <MaterialCommunityIcons name={icon} size={14} color={light ? Palette.black : Palette.white} />}
      <Text style={[styles.pillText, light && styles.pillTextLight]}>{label}</Text>
    </View>
  );
}

function Round({ icon, label, tint = Palette.surfaceRaised }: { icon: IconName; label?: string; tint?: string }) {
  return (
    <View style={styles.roundWrap}>
      <View style={[styles.round, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={20} color={Palette.white} />
      </View>
      {label && <Text style={styles.roundLabel}>{label}</Text>}
    </View>
  );
}

function Tile({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={styles.tile}>
      <MaterialCommunityIcons name={icon} size={30} color={color} />
    </View>
  );
}

/** Carte de tenue avec le cœur et la croix, comme sur l'accueil. */
function OutfitMock() {
  return (
    <View style={styles.mock}>
      <View style={styles.mockHeader}>
        <Pill icon="weather-partly-cloudy" label="14° · Casual" />
        <Text style={styles.mockCount}>3 pièces</Text>
      </View>
      <View style={styles.tilesRow}>
        <Tile icon="tshirt-crew" color="#3B82F6" />
        <Tile icon="hanger" color="#A8735A" />
        <Tile icon="shoe-sneaker" color="#1F2937" />
      </View>
      <View style={styles.swipeRow}>
        <View style={[styles.swipeBtn, { backgroundColor: '#FF3B4E' }]}><MaterialCommunityIcons name="close-thick" size={18} color={Palette.white} /></View>
        <View style={styles.wornBtn}><Text style={styles.wornText}>Je la porte</Text></View>
        <View style={[styles.swipeBtn, { backgroundColor: Palette.accent }]}><MaterialCommunityIcons name="heart" size={18} color={Palette.white} /></View>
      </View>
    </View>
  );
}

function WeatherMock() {
  return (
    <View style={styles.mock}>
      <Text style={styles.mockCity}>Paris · Éclaircies</Text>
      <Text style={styles.mockTemp}>14°</Text>
      <View style={styles.roundsRow}>
        <Round icon="creation" label="Styliste" tint={Palette.accent} />
        <Round icon="information-variant" label="Plus d’infos" />
        <Round icon="autorenew" label="Nouvelle série" />
      </View>
      <View style={styles.chipsRow}>
        <Pill label="Aujourd’hui" light />
        <Pill label="Demain" />
        <Pill label="Après-demain" />
      </View>
    </View>
  );
}

function WardrobeMock() {
  return (
    <View style={styles.mock}>
      <View style={styles.roundsRow}>
        <Round icon="camera" label="Photo" />
        <Round icon="image-multiple" label="Galerie" />
        <Round icon="human-handsup" label="Tenue" tint={Palette.accent} />
        <Round icon="storefront" label="Importer" />
      </View>
      <View style={styles.tilesRow}>
        <Tile icon="tshirt-crew" color="#EC4899" />
        <Tile icon="bag-personal" color="#A8735A" />
        <Tile icon="sunglasses" color="#1F2937" />
      </View>
    </View>
  );
}

function TripMock() {
  return (
    <View style={styles.mock}>
      <View style={styles.tripRow}>
        <MaterialCommunityIcons name="bag-suitcase" size={28} color={Palette.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.tripTitle}>Barcelone</Text>
          <Text style={styles.tripSub}>4 jours · 22° / 15° · 1 jour de pluie</Text>
        </View>
      </View>
      <View style={styles.checkList}>
        {['3 T-shirts', '1 pantalon', '1 veste légère'].map((line, i) => (
          <View key={line} style={styles.checkLine}>
            <MaterialCommunityIcons name={i < 2 ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={18} color={i < 2 ? Palette.success : Palette.textSecondary} />
            <Text style={styles.checkText}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProfileMock() {
  const rows: { icon: IconName; tint: string; label: string }[] = [
    { icon: 'bell-ring', tint: '#EF4444', label: 'Rappel du matin' },
    { icon: 'calendar-star', tint: '#3B82F6', label: 'Adapter à mon calendrier' },
    { icon: 'cloud-check', tint: '#1FBF8F', label: 'Synchronisation en ligne' },
  ];
  return (
    <View style={styles.mock}>
      {rows.map((r) => (
        <View key={r.label} style={styles.settingRow}>
          <View style={[styles.settingBadge, { backgroundColor: r.tint }]}><MaterialCommunityIcons name={r.icon} size={16} color={Palette.white} /></View>
          <Text style={styles.settingText}>{r.label}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={Palette.textSecondary} />
        </View>
      ))}
    </View>
  );
}

// ---------- Contenu ----------
interface Slide { icon: IconName; title: string; text: string; visual: ReactNode }

const SLIDES: Slide[] = [
  {
    icon: 'cards-heart',
    title: 'Ta tenue du jour',
    text: 'Chaque jour, l’app compose des tenues avec tes vêtements propres, selon la météo. Glisse à droite pour garder, à gauche pour passer, et « Je la porte » quand tu l’as choisie.',
    visual: <OutfitMock />,
  },
  {
    icon: 'weather-partly-cloudy',
    title: 'La météo en un coup d’œil',
    text: 'Choisis aujourd’hui, demain ou après-demain, et l’occasion de ta journée. « Plus d’infos » détaille la pluie et le vent, et le styliste répond à tes questions.',
    visual: <WeatherMock />,
  },
  {
    icon: 'hanger',
    title: 'Remplis ton dressing',
    text: 'Prends un vêtement en photo : l’app reconnaît son type et ses couleurs. « Tenue » ajoute toutes les pièces d’une photo de toi en pied, et « Importer » récupère tes achats en ligne.',
    visual: <WardrobeMock />,
  },
  {
    icon: 'bag-suitcase',
    title: 'Ta valise en une minute',
    text: 'Indique ta destination et tes dates : l’app prépare une valise qui va avec la météo du séjour, et tu coches les pièces au fur et à mesure.',
    visual: <TripMock />,
  },
  {
    icon: 'account-cog',
    title: 'À ton goût',
    text: 'Dans ton profil, programme un rappel chaque matin, laisse l’app lire ton calendrier pour deviner l’occasion, et sauvegarde ton dressing en ligne.',
    visual: <ProfileMock />,
  },
];

// ---------- Fenêtre ----------
export default function TutorialModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && <Tutorial onClose={onClose} />}
    </Modal>
  );
}

function Tutorial({ onClose }: { onClose: () => void }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = () => { markTutorialSeen(); onClose(); };
  const goTo = (i: number) => { setIndex(i); scrollRef.current?.scrollTo({ x: i * width, animated: true }); };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <AuroraScreen variant="hero">
      <View style={styles.header}>
        <Text style={styles.counter}>{index + 1} / {SLIDES.length}</Text>
        {!last && (
          <Pressable onPress={finish} hitSlop={10}>
            <Text style={styles.skip}>Passer</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
      >
        {SLIDES.map((slide) => (
          <ScrollView key={slide.title} style={{ width }} contentContainerStyle={styles.slide} showsVerticalScrollIndicator={false}>
            <View style={styles.visual}>{slide.visual}</View>
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}><MaterialCommunityIcons name={slide.icon} size={20} color={Palette.white} /></View>
              <Text style={styles.title}>{slide.title}</Text>
            </View>
            <Text style={styles.text}>{slide.text}</Text>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => <View key={slide.title} style={[styles.dot, i === index && styles.dotOn]} />)}
        </View>
        <Pressable style={styles.primary} onPress={last ? finish : () => goTo(index + 1)}>
          <Text style={styles.primaryText}>{last ? 'C’est parti !' : 'Suivant'}</Text>
        </Pressable>
      </View>
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, height: 44 },
  counter: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  skip: { color: Palette.white, fontSize: 15, fontWeight: '600', opacity: 0.85 },

  slide: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 18 },
  visual: { paddingVertical: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  titleIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: Palette.white, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  text: { color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 25 },

  footer: { paddingHorizontal: 20, paddingBottom: 24, gap: 20, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6, height: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.white, opacity: 0.35 },
  dotOn: { width: 24, opacity: 1 },
  primary: { alignSelf: 'stretch', backgroundColor: Palette.white, borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  primaryText: { color: Palette.black, fontSize: 16, fontWeight: '700' },

  // Maquettes
  mock: { backgroundColor: Palette.surface, borderRadius: 28, padding: 16, gap: 14 },
  mockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mockCount: { color: Palette.textSecondary, fontSize: 13 },
  mockCity: { color: Palette.white, fontSize: 15, fontWeight: '500', textAlign: 'center', opacity: 0.9 },
  mockTemp: { color: Palette.white, fontSize: 56, lineHeight: 62, fontWeight: '700', textAlign: 'center', letterSpacing: -1.5 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.surfaceRaised,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  pillLight: { backgroundColor: Palette.white },
  pillText: { color: Palette.white, fontSize: 12, fontWeight: '600' },
  pillTextLight: { color: Palette.black },
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, aspectRatio: 1, borderRadius: 18, backgroundColor: Palette.studio, alignItems: 'center', justifyContent: 'center' },
  swipeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swipeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  wornBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  wornText: { color: Palette.black, fontWeight: '700' },
  roundsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  roundWrap: { alignItems: 'center', gap: 6 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { color: Palette.text, fontSize: 11, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripTitle: { color: Palette.text, fontSize: 17, fontWeight: '700' },
  tripSub: { color: Palette.textSecondary, fontSize: 13, marginTop: 2 },
  checkList: { gap: 8 },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { color: Palette.text, fontSize: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingBadge: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1, color: Palette.text, fontSize: 15 },
});
