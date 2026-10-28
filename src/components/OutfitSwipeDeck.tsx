import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Ref } from 'react';
import { useEffect, useImperativeHandle, useMemo } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
    Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { COLOR_HEX, TYPE_LABELS } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import type { IconName } from '@/services/weatherIcon';
import { allColors, type ClothingItem, type ClothingType, type Outfit } from '@/types';

export type SwipeDirection = 'left' | 'right';

export interface SwipeDeckHandle {
  /** Fait partir la carte du dessus, comme si on l'avait glissée. */
  swipe: (direction: SwipeDirection) => void;
}

interface Props {
  outfit: Outfit;
  /** Vrai s'il reste une tenue derrière : on affiche alors une « pile » de cartes. */
  hasNext: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Petit texte en haut de la carte, ex. « 11° · Casual ». */
  caption?: string;
  weatherIcon?: IconName;
  ref?: Ref<SwipeDeckHandle>;
}

// Accessoires : affichés en vignettes sous les pièces principales
const ACCESSORIES: ClothingType[] = ['chaussures', 'echarpe', 'bonnet', 'parapluie'];
// Pièces principales rangées de haut en bas, comme on les porte
const LAYER_ORDER: ClothingType[] = [
  'veste_epaisse', 'veste', 'veste_legere', 'pull', 'chemise', 'tshirt', 'robe', 'pantalon', 'jupe', 'short',
];

const CARD_PADDING = 14;
const GAP = 10;
const SCREEN_PADDING = 16; // marge latérale de l'écran d'accueil

/** Photo d'une pièce avec son nom et ses couleurs posés dessus. */
function Tile({ item, width, height }: { item: ClothingItem; width: number; height: number }) {
  return (
    <View style={[styles.tile, { width, height }]}>
      <Image source={{ uri: item.uri }} style={styles.tileImg} />
      <View style={styles.tileChip}>
        <Text style={styles.tileLabel} numberOfLines={1}>{TYPE_LABELS[item.type]}</Text>
        {allColors(item).map((c) => <View key={c} style={[styles.dot, { backgroundColor: COLOR_HEX[c] }]} />)}
      </View>
    </View>
  );
}

/** Mise en page « lookbook » des pièces principales selon leur nombre. */
function Mosaic({ items, inner }: { items: ClothingItem[]; inner: number }) {
  const col = (inner - GAP) / 2;
  if (items.length === 1) return <Tile item={items[0]} width={inner} height={inner * 0.9} />;
  if (items.length === 2) {
    return (
      <View style={styles.row}>
        {items.map((it) => <Tile key={it.id} item={it} width={col} height={col * 1.3} />)}
      </View>
    );
  }
  if (items.length === 3) {
    // Une grande photo à gauche, deux plus petites empilées à droite
    const small = col * 0.95;
    return (
      <View style={styles.row}>
        <Tile item={items[0]} width={col} height={small * 2 + GAP} />
        <View style={styles.column}>
          <Tile item={items[1]} width={col} height={small} />
          <Tile item={items[2]} width={col} height={small} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.row, styles.wrap]}>
      {items.map((it) => <Tile key={it.id} item={it} width={col} height={col} />)}
    </View>
  );
}

const BEHIND_SCALE = 0.94;
const BEHIND_OFFSET = 14;

// ---------- Retour haptique (appelé depuis le thread UI via scheduleOnRN) ----------
/** Petit « tic » quand le doigt franchit le seuil de validation. */
function tickHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

/** Garder = vibration de succès, passer = choc léger. */
function swipeHaptic(direction: SwipeDirection) {
  const run = direction === 'right'
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => {});
}

const keyOf = (outfit: Outfit) => outfit.items.map((i) => i.id).join('|');

/** Envoie la carte hors de l'écran puis prévient React. Utilisable depuis le geste ou depuis un bouton. */
function flyOut(
  translateX: SharedValue<number>,
  locked: SharedValue<boolean>,
  direction: SwipeDirection,
  width: number,
  onSwipe: (direction: SwipeDirection) => void,
) {
  'worklet';
  if (locked.value) return;
  locked.value = true;
  scheduleOnRN(swipeHaptic, direction);
  const destination = direction === 'right' ? width * 1.4 : -width * 1.4;
  translateX.value = withTiming(destination, { duration: 220 }, (finished) => {
    if (finished) scheduleOnRN(onSwipe, direction);
  });
}

function SwipeCard({ outfit, hasNext, onSwipe, caption, weatherIcon, ref }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const enter = useSharedValue(0); // 0 → 1 : la carte « monte » depuis la pile
  const locked = useSharedValue(false);
  const armed = useSharedValue(0); // -1 / 0 / 1 : côté du seuil franchi pendant le glissement

  const inner = width - SCREEN_PADDING * 2 - CARD_PADDING * 2;
  const main = outfit.items
    .filter((i) => !ACCESSORIES.includes(i.type))
    .sort((a, b) => LAYER_ORDER.indexOf(a.type) - LAYER_ORDER.indexOf(b.type));
  const accessories = outfit.items.filter((i) => ACCESSORIES.includes(i.type));

  useEffect(() => {
    enter.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  useImperativeHandle(ref, () => ({
    swipe: (direction) => flyOut(translateX, locked, direction, width, onSwipe),
  }), [translateX, locked, width, onSwipe]);

  const pan = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-24, 24])
      .onUpdate((e) => {
        if (locked.value) return;
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values must be mutated in gesture worklets.
        translateX.value = e.translationX;
        // Tic haptique à chaque franchissement du seuil (et à chaque retour au-dessus)
        const side = Math.abs(e.translationX) > width * 0.28 ? Math.sign(e.translationX) : 0;
        if (side !== armed.value) {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values must be mutated in gesture worklets.
          armed.value = side;
          if (side !== 0) scheduleOnRN(tickHaptic);
        }
      })
      .onEnd((e) => {
        if (locked.value) return;
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values must be mutated in gesture worklets.
        armed.value = 0;
        // On tient compte de la vitesse : un petit coup sec suffit
        const projected = e.translationX + e.velocityX * 0.15;
        if (Math.abs(projected) < width * 0.28) {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values must be mutated in gesture worklets.
          translateX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
          return;
        }
        flyOut(translateX, locked, projected > 0 ? 'right' : 'left', width, onSwipe);
      }),
    [armed, locked, onSwipe, translateX, width],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: BEHIND_OFFSET * (1 - enter.value) },
      { scale: BEHIND_SCALE + (1 - BEHIND_SCALE) * enter.value },
      {
        rotateZ: `${interpolate(translateX.value, [-width, 0, width], [-14, 0, 14], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const keepTint = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, width * 0.3], [0, 0.18], Extrapolation.CLAMP),
  }));
  const skipTint = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-width * 0.3, 0], [0.18, 0], Extrapolation.CLAMP),
  }));
  const keepBadge = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [10, width * 0.25], [0, 1], Extrapolation.CLAMP),
  }));
  const skipBadge = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-width * 0.25, -10], [1, 0], Extrapolation.CLAMP),
  }));

  // La carte de derrière grandit quand on tire celle du dessus
  const plateStyle = useAnimatedStyle(() => {
    const progress = interpolate(Math.abs(translateX.value), [0, width * 0.4], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 0.6 + 0.4 * progress,
      transform: [
        { translateY: BEHIND_OFFSET * (1 - progress) },
        { scale: BEHIND_SCALE + (1 - BEHIND_SCALE) * progress },
      ],
    };
  });

  return (
    <View style={styles.wrapper}>
      {hasNext && <Animated.View style={[styles.plate, plateStyle]} />}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: Palette.accent }, keepTint]} />
          <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: Palette.danger }, skipTint]} />

          <Animated.View pointerEvents="none" style={[styles.badge, styles.keepBadge, keepBadge]}>
            <MaterialCommunityIcons name="heart" size={20} color={Palette.accent} />
            <Text style={[styles.badgeText, { color: Palette.accent }]}>GARDER</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.badge, styles.skipBadge, skipBadge]}>
            <MaterialCommunityIcons name="close" size={20} color={Palette.danger} />
            <Text style={[styles.badgeText, { color: Palette.danger }]}>PASSER</Text>
          </Animated.View>

          <View style={styles.header}>
            <View style={styles.headerChip}>
              {weatherIcon && <MaterialCommunityIcons name={weatherIcon} size={15} color={Palette.text} />}
              <Text style={styles.headerChipText}>{caption ?? 'Tenue proposée'}</Text>
            </View>
            <Text style={styles.headerCount}>{outfit.items.length} pièce{outfit.items.length > 1 ? 's' : ''}</Text>
          </View>

          {main.length > 0 && <Mosaic items={main} inner={inner} />}

          {accessories.length > 0 && (
            <View style={styles.accessories}>
              {accessories.map((item) => (
                <View key={item.id} style={styles.accessory}>
                  <Image source={{ uri: item.uri }} style={styles.accessoryImg} />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.accessoryLabel} numberOfLines={1}>{TYPE_LABELS[item.type]}</Text>
                    <View style={styles.dots}>
                      {allColors(item).map((c) => <View key={c} style={[styles.dot, { backgroundColor: COLOR_HEX[c] }]} />)}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {outfit.notes.map((n) => (
            <View key={n} style={styles.note}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Palette.warning} />
              <Text style={styles.noteText}>{n}</Text>
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Pile de cartes : la tenue du dessus se glisse, celle de derrière attend. */
export function OutfitSwipeDeck(props: Props) {
  // key = une nouvelle carte repart toujours de zéro (position, animation d'entrée, verrou)
  return <SwipeCard key={keyOf(props.outfit)} {...props} />;
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: BEHIND_OFFSET + 4 },
  plate: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Palette.surfaceSelected, borderRadius: 28, opacity: 0.6,
  },
  card: {
    backgroundColor: Palette.surface, borderRadius: 28, padding: CARD_PADDING, gap: 12, overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Palette.surfaceRaised, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  headerChipText: { color: Palette.text, fontSize: 13, fontWeight: '600' },
  headerCount: { color: Palette.textSecondary, fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', gap: GAP },
  wrap: { flexWrap: 'wrap' },
  column: { gap: GAP },
  tile: { borderRadius: 20, overflow: 'hidden', backgroundColor: Palette.surfaceRaised },
  tileImg: { width: '100%', height: '100%' },
  tileChip: {
    position: 'absolute', left: 8, bottom: 8, maxWidth: '90%',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  tileLabel: { color: Palette.white, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  accessories: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  accessory: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, minWidth: '45%',
    backgroundColor: Palette.surfaceRaised, borderRadius: 18, padding: 8,
  },
  accessoryImg: { width: 48, height: 48, borderRadius: 12, backgroundColor: Palette.surfaceSelected },
  accessoryLabel: { color: Palette.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  tint: { ...StyleSheet.absoluteFill, zIndex: 1 },
  badge: {
    position: 'absolute', top: 18, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Palette.surface,
  },
  keepBadge: { left: 18, borderColor: Palette.accent, transform: [{ rotate: '-10deg' }] },
  skipBadge: { right: 18, borderColor: Palette.danger, transform: [{ rotate: '10deg' }] },
  badgeText: { fontSize: 15, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: Palette.hairline },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
  },
  noteText: { color: Palette.warning, fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
