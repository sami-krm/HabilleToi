import type { ReactNode } from 'react';
import { type Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuroraBackground from '@/components/AuroraBackground';
import { Palette } from '@/constants/theme';

/** Écran sombre avec le dégradé violet derrière le contenu. */
interface Props {
  children: ReactNode;
  variant?: 'hero' | 'soft';
  scrollY?: Animated.Value;
}

export default function AuroraScreen({ children, variant, scrollY }: Props) {
  return (
    <View style={styles.root}>
      <AuroraBackground variant={variant} scrollY={scrollY} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  safe: { flex: 1 },
});
