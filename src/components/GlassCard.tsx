import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { Glass } from '@/constants/theme';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Vrai liquid glass sur iOS 26+, sinon ton style « Glass » habituel. */
export function GlassCard({ children, style }: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.card, style]}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.card, Glass, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 18, overflow: 'hidden' },
});