import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { loadReminderSettings, saveReminderSettings } from '@/features/notifications/reminderSettings';
import type { ReminderSettings } from '@/features/notifications/reminderSettings';
import type { DayWeather } from '@/features/trip/tripTypes';
import { addDaysISO, parseISO, todayISO } from '@/services/tripDates';
import { getTripWeather } from '@/services/tripWeather';
import { loadSavedLocation } from '@/services/weatherService';

/**
 * Une notification programmée garde un texte figé. Pour que chaque matin affiche la météo du jour,
 * on programme les prochains jours un par un à partir de la prévision, et on les recalcule à chaque ouverture de l'app.
 */
const CHANNEL_ID = 'morning-outfit';
const ID_PREFIX = 'morning-';
const DAYS_AHEAD = 14; // l'API météo prévoit environ 16 jours

// Même réglage que celui de l'import : afficher la notification même si l'app est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export class ReminderError extends Error {}

// ---------- Texte ----------
/** Ex. « 12 °C et pluie : ta tenue est prête. » */
export function reminderBody(d: DayWeather): string {
  const feels = 0.6 * d.tMax + 0.4 * d.tMin; // même pondération que la valise
  const min = Math.round(d.tMin);
  const max = Math.round(d.tMax);
  const temp = max - min >= 8 ? `${min} à ${max} °C` : `${Math.round(feels)} °C`;

  const rain = d.precipitation >= 1;
  const wind = d.windMax > 30;
  const condition = rain && wind ? 'pluie et vent' : rain ? 'pluie' : wind ? 'vent' : null;

  return `${condition ? `${temp} et ${condition}` : temp} : ta tenue est prête.`;
}

// ---------- Permission et canal ----------
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappel du matin',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Vrai si l'app a le droit d'envoyer des notifications (la demande est faite si besoin). */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel(); // sur Android 13+, le canal doit exister avant la demande
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// ---------- Position et prévision ----------
async function getCoords(saved: ReminderSettings['coords']) {
  const manual = await loadSavedLocation();
  if (manual) return { latitude: manual.latitude, longitude: manual.longitude };
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) {
      try {
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: cur.coords.latitude, longitude: cur.coords.longitude };
      } catch {
        const last = await Location.getLastKnownPositionAsync();
        if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
    }
  } catch {
    // on retombe sur la position enregistrée
  }
  return saved ?? null;
}

async function fetchForecast(settings: ReminderSettings) {
  const coords = await getCoords(settings.coords);
  if (!coords) throw new ReminderError('Position indisponible : autorise la localisation pour recevoir la météo.');
  try {
    const start = todayISO();
    const { days } = await getTripWeather({ name: '', ...coords }, start, addDaysISO(start, DAYS_AHEAD - 1));
    return { coords, days };
  } catch {
    throw new ReminderError('Météo indisponible (connexion ?).');
  }
}

// ---------- Programmation ----------
export async function cancelMorningReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Programme un rappel par matin pour les prochains jours. Renvoie le nombre de rappels programmés. */
export async function scheduleMorningReminders(settings: ReminderSettings): Promise<number> {
  // On récupère d'abord la prévision : si elle échoue, les rappels déjà programmés restent en place
  const { coords, days } = await fetchForecast(settings);
  await ensureChannel();
  await cancelMorningReminders();

  const now = Date.now();
  let count = 0;
  for (const day of days) {
    const date = parseISO(day.date);
    date.setHours(settings.hour, settings.minute, 0, 0);
    if (date.getTime() <= now + 10_000) continue; // l'heure du jour est déjà passée

    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${day.date}`,
      content: { title: 'Ta tenue du jour', body: reminderBody(day) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
    count++;
  }

  await saveReminderSettings({ ...settings, coords });
  return count;
}

/** À appeler à l'ouverture de l'app : remet les rappels à jour avec la dernière prévision. */
export async function refreshMorningReminders(): Promise<void> {
  const settings = await loadReminderSettings();
  if (!settings.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await scheduleMorningReminders(settings);
}

/** Envoie un rappel d'essai dans 5 secondes, avec la météo d'aujourd'hui. */
export async function sendTestReminder(): Promise<void> {
  const settings = await loadReminderSettings();
  const { days } = await fetchForecast(settings);
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Ta tenue du jour', body: reminderBody(days[0]) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
}
