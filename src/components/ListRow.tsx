import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  icon: IconName;
  /** Couleur de la pastille ronde derrière l'icône. */
  tint: string;
  title: string;
  subtitle?: string;
  value?: ReactNode;
  onPress?: () => void;
}

/** Ligne de liste : pastille colorée, titre, sous-titre gris et valeur à droite. */
export function ListRow({ icon, tint, title, subtitle, value, onPress }: Props) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]} onPress={onPress} disabled={!onPress}>
      <View style={[styles.badge, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={24} color={Palette.white} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {typeof value === 'string' ? <Text style={styles.value}>{value}</Text> : value}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  pressed: { opacity: 0.6 },
  badge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  title: { color: Palette.text, fontSize: 17, fontWeight: '600' },
  subtitle: { color: Palette.textSecondary, fontSize: 14 },
  value: { color: Palette.text, fontSize: 17, fontWeight: '600' },
});
