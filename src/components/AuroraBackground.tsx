import { Animated, Platform, StyleSheet, View } from 'react-native';

import { HeaderGradient, Palette, SoftGradient } from '@/constants/theme';

type Variant = 'hero' | 'soft';

const HEIGHT: Record<Variant, number> = { hero: 620, soft: 320 };

interface Props {
  variant?: Variant;
  /** Défilement de l'écran : le dégradé remonte avec le contenu. */
  scrollY?: Animated.Value;
}

/** Fond d'écran : dégradé violet en haut qui se fond dans le noir. */
export default function AuroraBackground({ variant = 'soft', scrollY }: Props) {
  const gradient = variant === 'hero' ? HeaderGradient : SoftGradient;
  const translateY = scrollY
    ? scrollY.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, -1], extrapolateLeft: 'clamp' })
    : 0;
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <Animated.View
        style={[
          styles.gradient,
          { height: HEIGHT[variant], transform: [{ translateY }] },
          // Le web ne connaît que la propriété CSS standard
          Platform.OS === 'web' ? ({ backgroundImage: gradient } as object) : { experimental_backgroundImage: gradient },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Palette.background },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0 },
});
