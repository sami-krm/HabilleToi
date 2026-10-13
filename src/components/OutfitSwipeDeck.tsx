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

import { Palette } from '@/constants/theme';
import type { ColorName, Outfit } from '@/types';
import { allColors } from '@/types';

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
  ref?: Ref<SwipeDeckHandle>;
}

const COLOR_HEX: Record<ColorName, string> = {
  noir: '#111111', blanc: '#FFFFFF', gris: '#9E9E9E', beige: '#D8C3A5',
  marine: '#1F2A44', marron: '#6B4423', bleu: '#2F6FED', rouge: '#D32F2F',
  vert: '#2E8B57', jaune: '#F4C430', orange: '#F57C00', rose: '#F48FB1', violet: '#7E57C2',
};

const TYPE_LABEL: Record<string, string> = {
  tshirt: 'T-shirt', chemise: 'Chemise', pull: 'Pull', veste: 'Veste',
  pantalon: 'Pantalon', short: 'Short', chaussures: 'Chaussures',
};

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

function SwipeCard({ outfit, hasNext, onSwipe, ref }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const enter = useSharedValue(0); // 0 → 1 : la carte « monte » depuis la pile
  const locked = useSharedValue(false);
  const armed = useSharedValue(0); // -1 / 0 / 1 : côté du seuil franchi pendant le glissement

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
        translateX.value = e.translationX;
        // Tic haptique à chaque franchissement du seuil (et à chaque retour au-dessus)
        const side = Math.abs(e.translationX) > width * 0.28 ? Math.sign(e.translationX) : 0;
        if (side !== armed.value) {
          armed.value = side;
          if (side !== 0) scheduleOnRN(tickHaptic);
        }
      })
      .onEnd((e) => {
        if (locked.value) return;
        armed.value = 0;
        // On tient compte de la vitesse : un petit coup sec suffit
        const projected = e.translationX + e.velocityX * 0.15;
        if (Math.abs(projected) < width * 0.28) {
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

          <View style={styles.grid}>
            {outfit.items.map((item) => (
              <View key={item.id} style={styles.piece}>
                <Image source={{ uri: item.uri }} style={styles.pieceImg} />
                <View style={styles.pieceInfo}>
                  <Text style={styles.pieceLabel} numberOfLines={1}>{TYPE_LABEL[item.type] ?? item.type}</Text>
                  <View style={styles.dots}>
                    {allColors(item).map((c) => (
                      <View key={c} style={[styles.dot, { backgroundColor: COLOR_HEX[c] }]} />
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {outfit.notes.map((n) => <Text key={n} style={styles.note}>{n}</Text>)}
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
    backgroundColor: Palette.surface, borderRadius: 24,
  },
  card: {
    backgroundColor: Palette.surfaceRaised, borderRadius: 24, padding: 12, gap: 10,
    borderWidth: 1, borderColor: Palette.border, overflow: 'hidden',
    shadowColor: Palette.shadow, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tint: { ...StyleSheet.absoluteFill, zIndex: 1 },
  badge: {
    position: 'absolute', top: 18, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Palette.surface,
  },
  keepBadge: { left: 18, borderColor: Palette.accent, transform: [{ rotate: '-10deg' }] },
  skipBadge: { right: 18, borderColor: Palette.danger, transform: [{ rotate: '10deg' }] },
  badgeText: { fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  piece: { width: '48%' },
  pieceImg: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: Palette.surface },
  pieceInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  pieceLabel: { fontWeight: '600', flexShrink: 1, color: Palette.text },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Palette.hairline },
  note: { color: Palette.warning },
});
