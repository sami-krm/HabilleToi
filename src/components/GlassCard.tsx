import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Glass, Radius } from '@/constants/theme';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Carte sombre aux coins très arrondis. */
export function GlassCard({ children, style }: Props) {
  return <View style={[styles.card, Glass, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: 18, overflow: 'hidden' },
});
