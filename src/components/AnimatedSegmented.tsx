import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

const PADDING = 4;
const SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

interface Option<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (key: T) => void;
  pillColor?: string; // couleur de la pastille qui glisse
}

// Texte d'une option : passe en blanc quand la pastille arrive dessus.
function Label({ index, pos, label }: { index: number; pos: SharedValue<number>; label: string }) {
  const style = useAnimatedStyle(() => {
    const progress = 1 - Math.min(Math.abs(pos.value - index), 1);
    return { color: interpolateColor(progress, [0, 1], [Palette.textSecondary, Palette.onAccent]) };
  });
  return <Animated.Text style={[styles.label, style]}>{label}</Animated.Text>;
}

export function AnimatedSegmented<T extends string>({
  options,
  value,
  onChange,
  pillColor = Palette.ink,
}: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const pos = useSharedValue(index); // position (fractionnaire) de la pastille

  // Glisse vers la nouvelle option quand la valeur change.
  useEffect(() => {
    pos.value = withSpring(index, SPRING);
  }, [index, pos]);

  const pillWidth = width > 0 ? (width - PADDING * 2) / options.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth,
    transform: [{ translateX: pos.value * pillWidth }],
  }));

  return (
    <View style={styles.track} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {pillWidth > 0 && <Animated.View style={[styles.pill, { backgroundColor: pillColor }, pillStyle]} />}
      {options.map((o, i) => (
        <Pressable
          key={o.key}
          style={styles.segment}
          onPress={() => {
            if (o.key === value) return;
            Haptics.selectionAsync().catch(() => {});
            onChange(o.key);
          }}
        >
          <Label index={i} pos={pos} label={o.label} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PADDING,
    borderRadius: 999,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  pill: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: 999,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  label: { fontWeight: '600', fontSize: 14 },
});