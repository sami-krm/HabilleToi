import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReminderSettings {
  enabled: boolean;
  hour: number;    // 0-23
  minute: number;  // 0-59
  /** Dernière position connue : sert de secours si la localisation est indisponible. */
  coords?: { latitude: number; longitude: number };
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 7, minute: 30 };

const KEY = '@app/morning-reminder';

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<ReminderSettings>) } : DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
}

export const saveReminderSettings = (settings: ReminderSettings) =>
  AsyncStorage.setItem(KEY, JSON.stringify(settings));