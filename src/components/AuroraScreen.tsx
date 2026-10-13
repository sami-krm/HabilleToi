import type { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import AuroraBackground from '@/components/AuroraBackground';
import { Palette } from '@/constants/theme';

/** Écran avec le fond aurore derrière le contenu. */
export default function AuroraScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  safe: { flex: 1 },
});