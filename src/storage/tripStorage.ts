import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrip } from '@/features/trip/tripTypes';

const TRIPS_KEY = '@wardrobe/trips';

export async function loadTrips(): Promise<SavedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(TRIPS_KEY);
    return raw ? (JSON.parse(raw) as SavedTrip[]) : [];
  } catch {
    return [];
  }
}

export const saveTrips = (trips: SavedTrip[]) => AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));