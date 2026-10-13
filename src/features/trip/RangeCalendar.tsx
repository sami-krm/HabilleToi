import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass, Palette } from '@/constants/theme';
import { addDaysISO, diffDays, formatShort, parseISO, toISO } from '@/services/tripDates';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  start: string | null;   // « AAAA-MM-JJ »
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  minDate: string;        // premier jour sélectionnable (aujourd'hui)
  maxDate: string;        // dernier jour sélectionnable
  maxDays: number;        // durée maximale du séjour
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les jours d'un mois, semaine commençant le lundi ; null = case vide. */
function buildMonth(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= count; d++) cells.push(toISO(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

/** Calendrier de sélection d'une période (départ puis retour), façon sites de voyage. */
export default function RangeCalendar({ start, end, onChange, minDate, maxDate, maxDays }: Props) {
  const first = parseISO(start ?? minDate);
  const [view, setView] = useState({ year: first.getFullYear(), month: first.getMonth() });
  const rows = useMemo(() => chunk(buildMonth(view.year, view.month), 7), [view]);

  // Bornes de navigation entre les mois
  const index = (y: number, m: number) => y * 12 + m;
  const minD = parseISO(minDate);
  const maxD = parseISO(maxDate);
  const current = index(view.year, view.month);
  const canGoPrev = current > index(minD.getFullYear(), minD.getMonth());
  const canGoNext = current < index(maxD.getFullYear(), maxD.getMonth());

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  // Un premier toucher choisit le départ, le second le retour ; une date avant le départ recommence
  const press = (iso: string) => {
    if (!start || end) onChange(iso, null);
    else if (iso < start) onChange(iso, null);
    else onChange(start, iso);
  };

  // Pendant le choix du retour, on grise les jours qui dépasseraient la durée maximale
  const lastAllowedEnd = start && !end ? addDaysISO(start, maxDays - 1) : null;
  const isDisabled = (iso: string) =>
    iso < minDate || iso > maxDate || (lastAllowedEnd !== null && iso > lastAllowedEnd);

  const days = start && end ? diffDays(start, end) + 1 : null;
  const title = capitalize(
    new Date(view.year, view.month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  );

  const hint = !start
    ? 'Choisis ta date de départ'
    : !end
      ? `Choisis ta date de retour (${maxDays} jours maximum)`
      : `${days} jour${days && days > 1 ? 's' : ''} sur place`;

  return (
    <View style={styles.card}>
      {/* Résumé : départ et retour */}
      <View style={styles.tiles}>
        <View style={[styles.tile, !start && styles.tileActive]}>
          <Text style={styles.tileLabel}>Départ</Text>
          <Text style={[styles.tileValue, !start && styles.tilePlaceholder]}>
            {start ? capitalize(formatShort(start)) : 'Choisir'}
          </Text>
        </View>
        <View style={[styles.tile, !!start && !end && styles.tileActive]}>
          <Text style={styles.tileLabel}>Retour</Text>
          <Text style={[styles.tileValue, !end && styles.tilePlaceholder]}>
            {end ? capitalize(formatShort(end)) : 'Choisir'}
          </Text>
        </View>
      </View>

      {/* Navigation entre les mois */}
      <View style={styles.nav}>
        <Pressable
          style={[styles.navBtn, !canGoPrev && styles.navBtnOff]}
          onPress={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          accessibilityLabel="Mois précédent"
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={Palette.text} />
        </Pressable>
        <Text style={styles.monthTitle}>{title}</Text>
        <Pressable
          style={[styles.navBtn, !canGoNext && styles.navBtnOff]}
          onPress={() => shiftMonth(1)}
          disabled={!canGoNext}
          accessibilityLabel="Mois suivant"
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={Palette.text} />
        </Pressable>
      </View>

      {/* Jours de la semaine */}
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>{d}</Text>
        ))}
      </View>

      {/* Grille du mois */}
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((iso, c) => {
            if (!iso) return <View key={c} style={styles.cell} />;

            const isStart = iso === start;
            const isEnd = iso === end;
            const selected = isStart || isEnd;
            const inRange = !!start && !!end && iso > start && iso < end;
            const hasBand = !!start && !!end && start !== end && (selected || inRange);
            const disabled = isDisabled(iso);

            return (
              <Pressable
                key={c}
                style={styles.cell}
                disabled={disabled}
                onPress={() => press(iso)}
                accessibilityLabel={formatShort(iso)}
                accessibilityState={{ selected, disabled }}
              >
                {hasBand && (
                  <View
                    style={[
                      styles.band,
                      isStart ? { left: '50%', right: 0 } : isEnd ? { left: 0, right: '50%' } : { left: 0, right: 0 },
                    ]}
                  />
                )}
                <View style={[styles.day, selected && styles.daySelected, iso === minDate && !selected && styles.dayToday]}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayTextOff]}>
                    {parseISO(iso).getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...Glass, borderRadius: 24, padding: 12, gap: 8 },

  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, borderRadius: 16, padding: 10, gap: 2,
    backgroundColor: Palette.surfaceRaised, borderWidth: 1.5, borderColor: 'transparent',
  },
  tileActive: { borderColor: Palette.accent },
  tileLabel: { fontSize: 12, fontWeight: '700', color: Palette.textSecondary },
  tileValue: { fontSize: 15, fontWeight: '800', color: Palette.text },
  tilePlaceholder: { color: Palette.textSecondary, fontWeight: '600' },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  navBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.surfaceRaised,
  },
  navBtnOff: { opacity: 0.3 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: Palette.text },

  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Palette.textSecondary, paddingVertical: 4 },
  cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', top: 2, bottom: 2, backgroundColor: Palette.accentSoft },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: Palette.accent },
  dayToday: { borderWidth: 1.5, borderColor: Palette.accent },
  dayText: { fontSize: 15, fontWeight: '600', color: Palette.text },
  dayTextSelected: { color: Palette.onAccent, fontWeight: '800' },
  dayTextOff: { color: Palette.textSecondary, opacity: 0.35 },

  hint: { textAlign: 'center', color: Palette.textSecondary, fontSize: 13, marginTop: 4 },
});