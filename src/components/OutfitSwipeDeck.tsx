import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Ref } from 'react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
    Easing, Extrapolation, interpolate, Keyframe, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { COLOR_HEX, isAccessory, TYPE_LABELS } from '@/constants/clothing';
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

interface CardProps extends Props {
  /** Appelé dès que le choix est fait, avant que la carte ne sorte (déclenche l'animation). */
  onChoice: (direction: SwipeDirection) => void;
}

const HEART = '#7C5CFF';
const CROSS = '#FF3B4E';

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
      <Image source={{ uri: item.uri }} style={styles.tileImg} resizeMode="contain" />
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
  onChoice: (direction: SwipeDirection) => void,
) {
  'worklet';
  if (locked.value) return;
  locked.value = true;
  scheduleOnRN(swipeHaptic, direction);
  scheduleOnRN(onChoice, direction);
  const destination = direction === 'right' ? width * 1.4 : -width * 1.4;
  translateX.value = withTiming(destination, { duration: 220 }, (finished) => {
    if (finished) scheduleOnRN(onSwipe, direction);
  });
}

function SwipeCard({ outfit, hasNext, onSwipe, onChoice, caption, weatherIcon, ref }: CardProps) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const enter = useSharedValue(0); // 0 → 1 : la carte « monte » depuis la pile
  const locked = useSharedValue(false);
  const armed = useSharedValue(0); // -1 / 0 / 1 : côté du seuil franchi pendant le glissement

  const inner = width - SCREEN_PADDING * 2 - CARD_PADDING * 2;
  const main = outfit.items
    .filter((i) => !isAccessory(i.type))
    .sort((a, b) => LAYER_ORDER.indexOf(a.type) - LAYER_ORDER.indexOf(b.type));
  const accessories = outfit.items.filter((i) => isAccessory(i.type));

  useEffect(() => {
    enter.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  useImperativeHandle(ref, () => ({
    swipe: (direction) => flyOut(translateX, locked, direction, width, onSwipe, onChoice),
  }), [translateX, locked, width, onSwipe, onChoice]);

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
        flyOut(translateX, locked, projected > 0 ? 'right' : 'left', width, onSwipe, onChoice);
      }),
    [armed, locked, onSwipe, onChoice, translateX, width],
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

  // Cœur violet (droite) ou croix rouge (gauche) qui grandit au centre de la carte
  const heartStyle = useAnimatedStyle(() => {
    const p = interpolate(translateX.value, [10, width * 0.28], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.5 + 0.5 * p }] };
  });
  const crossStyle = useAnimatedStyle(() => {
    const p = interpolate(translateX.value, [-width * 0.28, -10], [1, 0], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.5 + 0.5 * p }] };
  });

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
          <View pointerEvents="none" style={styles.overlay}>
            <Animated.View style={[styles.overlayIcon, heartStyle]}>
              <MaterialCommunityIcons name="heart" size={110} color={HEART} />
            </Animated.View>
            <Animated.View style={[styles.overlayIcon, crossStyle]}>
              <MaterialCommunityIcons name="close-thick" size={110} color={CROSS} />
            </Animated.View>
          </View>

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
                  <Image source={{ uri: item.uri }} style={styles.accessoryImg} resizeMode="contain" />
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

// Le cœur ou la croix apparaît, grossit puis tombe vers le bas de l'écran
const burstKeyframe = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.4 }] },
  20: { opacity: 1, transform: [{ translateY: -10 }, { scale: 1.25 }], easing: Easing.out(Easing.back(2)) },
  45: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: 420 }, { scale: 0.7 }], easing: Easing.in(Easing.cubic) },
}).duration(900);

function Burst({ direction, onDone }: { direction: SwipeDirection; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 950);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <Animated.View pointerEvents="none" entering={burstKeyframe} style={styles.burst}>
      <MaterialCommunityIcons
        name={direction === 'right' ? 'heart' : 'close-thick'}
        size={120}
        color={direction === 'right' ? HEART : CROSS}
      />
    </Animated.View>
  );
}

/** Pile de cartes : la tenue du dessus se glisse, celle de derrière attend. */
export function OutfitSwipeDeck(props: Props) {
  const [bursts, setBursts] = useState<{ id: number; direction: SwipeDirection }[]>([]);
  const onChoice = useCallback((direction: SwipeDirection) => {
    setBursts((b) => [...b, { id: Date.now(), direction }]);
  }, []);
  const removeBurst = useCallback((id: number) => setBursts((b) => b.filter((x) => x.id !== id)), []);

  return (
    <View>
      {/* key = une nouvelle carte repart toujours de zéro (position, animation d'entrée, verrou) */}
      <SwipeCard key={keyOf(props.outfit)} {...props} onChoice={onChoice} />
      {bursts.map((b) => <Burst key={b.id} direction={b.direction} onDone={() => removeBurst(b.id)} />)}
    </View>
  );
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
  tile: { borderRadius: 20, overflow: 'hidden', backgroundColor: Palette.studio },
  tileImg: { width: '84%', height: '76%', marginHorizontal: '8%', marginTop: '6%' }, // place pour l'étiquette en bas
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
  accessoryImg: { width: 48, height: 48, borderRadius: 12, backgroundColor: Palette.studio },
  accessoryLabel: { color: Palette.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  overlayIcon: {
    position: 'absolute', width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  burst: {
    position: 'absolute', alignSelf: 'center', top: '35%', zIndex: 10,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: Palette.hairline },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
  },
  noteText: { color: Palette.warning, fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
