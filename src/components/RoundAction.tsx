import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Bouton rond avec son libellé dessous (rangée d'actions de l'accueil). */
export function RoundAction({ icon, label, onPress, disabled }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.root, (pressed || disabled) && styles.dimmed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.circle}>
        <MaterialCommunityIcons name={icon} size={26} color={Palette.text} />
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', gap: 10 },
  dimmed: { opacity: 0.45 },
  circle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center',
  },
  label: { color: Palette.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
