import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClothingType, ComfortFeedback } from '@/types';

const LAUNDRY_KEY = '@app/laundry-thresholds';
const SWIPES_KEY = '@app/outfit-preferences';
const FEEDBACK_KEY = '@app/comfort-feedback';

export const DEFAULT_LAUNDRY: Record<ClothingType, number> = {
  tshirt: 1, chemise: 1, pull: 3, veste: 5, veste_legere: 5, veste_epaisse: 5,
  pantalon: 5, short: 3, jupe: 2, robe: 2, chaussures: 10,
  echarpe: 5, bonnet: 5, parapluie: 20,
  sac: 30, ceinture: 30, casquette: 10, lunettes: 30, gants: 10, montre: 30, bijoux: 30,
};

export async function loadLaundryThresholds(): Promise<Record<ClothingType, number>> {
  try { const raw = await AsyncStorage.getItem(LAUNDRY_KEY); return { ...DEFAULT_LAUNDRY, ...(raw ? JSON.parse(raw) : {}) }; }
  catch { return DEFAULT_LAUNDRY; }
}
export const saveLaundryThresholds = (values: Record<ClothingType, number>) => AsyncStorage.setItem(LAUNDRY_KEY, JSON.stringify(values));

export interface OutfitPreferences { liked: Record<string, number>; rejected: Record<string, number> }
export async function loadOutfitPreferences(): Promise<OutfitPreferences> {
  try { const raw = await AsyncStorage.getItem(SWIPES_KEY); return raw ? JSON.parse(raw) as OutfitPreferences : { liked: {}, rejected: {} }; }
  catch { return { liked: {}, rejected: {} }; }
}
export async function recordOutfitPreference(signature: string, direction: 'right' | 'left') {
  const values = await loadOutfitPreferences();
  const bucket = direction === 'right' ? values.liked : values.rejected;
  bucket[signature] = Math.min(30, (bucket[signature] ?? 0) + 1);
  await AsyncStorage.setItem(SWIPES_KEY, JSON.stringify(values));
}

export interface ComfortEntry { wornAt: number; feedback: ComfortFeedback; temperature: number }
export async function loadComfortFeedback(): Promise<ComfortEntry[]> {
  try { const raw = await AsyncStorage.getItem(FEEDBACK_KEY); return raw ? JSON.parse(raw) as ComfortEntry[] : []; }
  catch { return []; }
}
export async function saveComfortFeedback(entry: ComfortEntry) {
  const values = await loadComfortFeedback();
  await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify([entry, ...values].slice(0, 180)));
}
