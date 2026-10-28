import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Groupe de réglages : titre discret puis carte arrondie qui contient les lignes. */
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title && <Text style={styles.groupTitle}>{title}</Text>}
      <View style={styles.card}>{children}</View>
      {footer && <Text style={styles.groupFooter}>{footer}</Text>}
    </View>
  );
}

interface RowProps {
  icon: IconName;
  tint: string;
  title: string;
  subtitle?: string;
  value?: string;
  /** Élément à droite (interrupteur...) ; sinon un chevron si la ligne est cliquable. */
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}

/** Ligne de réglage : pastille colorée, libellé, valeur et chevron. */
export function SettingsRow({ icon, tint, title, subtitle, value, right, onPress, danger, last }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.badge, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={19} color={Palette.white} />
      </View>
      <View style={[styles.main, !last && styles.separator]}>
        <View style={styles.texts}>
          <Text style={[styles.title, danger && styles.danger]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
        {right ?? (onPress && !danger ? <MaterialCommunityIcons name="chevron-right" size={22} color={Palette.textSecondary} /> : null)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupTitle: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 16 },
  groupFooter: { color: Palette.textSecondary, fontSize: 13, marginHorizontal: 16 },
  card: { backgroundColor: Palette.surface, borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, gap: 14 },
  pressed: { backgroundColor: Palette.surfaceRaised },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 14, minHeight: 56 },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  texts: { flex: 1, gap: 2 },
  title: { color: Palette.text, fontSize: 16, fontWeight: '500' },
  subtitle: { color: Palette.textSecondary, fontSize: 13 },
  value: { color: Palette.textSecondary, fontSize: 15, maxWidth: 150 },
  danger: { color: Palette.danger, fontWeight: '600' },
});
