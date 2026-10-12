import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClothingItem, FavoriteOutfit, WornOutfit } from '../types';

const WARDROBE_KEY = '@wardrobe/items';
const FAVORITES_KEY = '@wardrobe/favorites';
const HISTORY_KEY = '@wardrobe/history';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const loadWardrobe = () => readJson<ClothingItem[]>(WARDROBE_KEY, []);
export const saveWardrobe = (items: ClothingItem[]) =>
  AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(items));

export const loadFavorites = () => readJson<FavoriteOutfit[]>(FAVORITES_KEY, []);
export const saveFavorites = (favs: FavoriteOutfit[]) =>
  AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));

export const loadHistory = () => readJson<WornOutfit[]>(HISTORY_KEY, []);
export const saveHistory = (history: WornOutfit[]) =>
  AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));