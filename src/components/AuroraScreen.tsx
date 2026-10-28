import type { ReactNode } from 'react';
import { type Animated, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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
    // Fournisseur local : une fenêtre Modal ne reçoit pas les marges de l'écran principal
    <SafeAreaProvider style={styles.root}>
      <AuroraBackground variant={variant} scrollY={scrollY} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>{children}</SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  safe: { flex: 1 },
});
